/** Utility to manage AWS objects that represent the current profiles and region (when the region or profile changes, the AWS object (ie AWS::S3) will be switched */
const { Util } = require('@hawryschuk/common');
const AWS = require('aws-sdk');

module.exports = class AWSHelper {
  static get AWS() { return AWS; }

  static get region() { if (!this._region) this.region = process.env.API_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'; return this._region; }
  static set region(region) { AWS.config.update({ region: (this._region = region) }); }

  static get profiles() { return (this._profiles = this._profiles || {}); }

  static get profile() { return (this.profiles[this._profile] = this.profiles[this._profile] || { name: this._profile }); }
  static set profile(name) { if (Util.safely(() => AWS.config.credentials.profile)) { this._profile = name; AWS.config.credentials = (this.profile.credentials = this.profile.credentials || new AWS.SharedIniFileCredentials({ profile: name })); } }

  static getAWSClass(name, resolver) {
    return this.objectcache(name, () => {
      const klass = resolver ? resolver() : AWS[name];
      if (!klass) { console.log(`klass is not defined`, name) }
      return new klass();
    });
  }

  static objectcache(key, materialize) {
    const regionCache = (this.profile[this.region] = this.profile[this.region] || {});   // objectcache for the current {region,profile}
    return regionCache[key] = regionCache[key] || materialize();
  }

  static get S3() { return this.getAWSClass('S3'); }
  static get CloudWatchLogs() { return this.getAWSClass('CloudWatchLogs'); }
  static get CloudFormation() { return this.getAWSClass('CloudFormation'); }
  static get CodeBuild() { return this.getAWSClass('CodeBuild'); }
  static get APIGateway() { return this.getAWSClass('APIGateway'); }
  static get EC2() { return this.getAWSClass('EC2'); }
  static get DynamoDB() { return this.getAWSClass('DynamoDB'); }
  static get Lambda() { return this.getAWSClass('Lambda'); }
  static get DocumentClient() { return this.getAWSClass('DocumentClient', () => AWS.DynamoDB.DocumentClient); }
  static get SSM() { return this.getAWSClass('SSM'); }

  static get regions() { return this.EC2.describeRegions().promise().then(r => Util.pluck(r.Regions, 'RegionName')); }

  static async getStacks({ stage, errorForInProgress = true } = {}) {
    let ContinuationToken; let stacks = [];
    do {
      const { NextToken, StackSummaries } = await AWSHelper.cloudformation.listStacks({ NextToken: ContinuationToken }).promise();
      ContinuationToken = NextToken;
      stacks.push(...StackSummaries);
    } while (ContinuationToken);
    stacks = Object           // because a stack may be in the list twice, use the first occurence of the stack
      .values(stacks.reduce((stacks, stack) => ({ [stack.StackName]: stack, ...stacks }), {}))
      .filter(({ StackName }) => !stage || StackName.endsWith(`-${stage}`))
      .filter(({ StackStatus }) => !StackStatus.includes('DELETE_COMPLETE'));
    const stacksInProgress = Util.pluck(stacks.filter(s => s.StackStatus.includes('PROGRESS')), 'StackName');
    if (errorForInProgress && stacksInProgress.length) throw new Error(`Stacks in progress: ${stacksInProgress.join(', ')}`);
    return stacks;
  }

  static async getLogs({ stage, startTime, endTime = new Date(), logGroupName, queryString = '' }) {
    const logGroups = Util.pluck((await AWSHelper.logGroups({ stage })).filter(g => !logGroupName || (logGroupName instanceof Function ? logGroupName(g.logGroupName) : g.logGroupName === logGroupName)), 'logGroupName');
    const list = Object.assign([], { logGroups: [...logGroups] });
    while (logGroups.length) {
      await Promise.all(logGroups
        .splice(0, 4)                     // batch of 4 at a time , in order to not get the LimitExceededException
        .map(async  logGroupName => {
          const { queryId } = await AWSHelper.cloudwatchlogs.startQuery({ logGroupName, queryString, startTime: startTime.getTime(), endTime: endTime.getTime() }).promise();
          while (true) {  // wait until the status is complete -- then break out of the while-loop with the messages for this logGroup[Name]
            const { status, results } = await AWSHelper.cloudwatchlogs.getQueryResults({ queryId }).promise();
            if (status === 'Complete') {
              return list.push(...results.map(result => ({
                logGroupName,
                message: Util.findWhere(result, { field: '@message' }).value,
                timestamp: Util.findWhere(result, { field: '@timestamp' }).value
              })));
            } else {
              await Util.pause(1000);
            }
          }
        }));
    }
    return list.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  static Helpers = {
    CloudWatchLogs: class {
      static async logGroups({ logGroupNamePrefix, stage } = {}) {
        let nextToken; const groups = [];
        do {
          const result = await AWSHelper.CloudWatchLogs.describeLogGroups({ logGroupNamePrefix, nextToken }).promise();
          nextToken = result.nextToken;
          groups.push(...result.logGroups);
        } while (nextToken);
        return groups
          .sort((a, b) => a.logGroupName.localeCompare(b.logGroupName))
          .filter(g => !stage || (g.logGroupName.endsWith(`-${stage}`) || g.logGroupName.includes(`-${stage}-`)));
      }
    },
    DynamoDB: class {
      static async clear({ TableName, Key }) {
        const keys = await AWSHelper
          .DocumentClient
          .scan({
            TableName,
            Select: 'SPECIFIC_ATTRIBUTES',
            AttributesToGet: [Key]
          })
          .promise()
          .then(({ Items }) => Items.map(item => item[Key]));
        keys.length && await AWSHelper.DocumentClient.batchWrite({
          RequestItems: {
            [TableName]: keys.map(key => ({
              DeleteRequest: { Key: { [Key]: key } }
            }))
          }
        }).promise();
      }

      static count(TableName, attributes) {
        AWSHelper.DocumentClient.scan({
          TableName,
          Select: 'COUNT',
          FilterExpression: Object.keys(attributes).map(Key => `#${Key}=:${Key}`).join(' and '),
          ExpressionAttributeNames: Object.keys(attributes).reduce((hash, Key) => ({ ...hash, [`#${Key}`]: Key }), {}),
          ExpressionAttributeValues: Object.entries(attributes).reduce((hash, [Key, Value]) => ({ ...hash, [`:${Key}`]: Value }), {})
        }).promise().then(r => r.Count)
      }
    },
    Lambda: class {
      static async invoke(FunctionName, payload) {
        await AWSHelper.Lambda.invoke({
          FunctionName,
          Payload: JSON.stringify(payload),
          InvocationType: 'RequestResponse'
        }).promise();
      }
    },
    SSM: class {
      static async getParameter(Name) {
        const { Parameter: Value } = await AWSHelper.SSM
          .getParameter({ Name, WithDecryption: false }).promise()
          .then(({ Parameter: { Value } }) => Value);
      }
    }
  };
};
