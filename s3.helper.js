/** AWS::S3 - Helper - get/set/update [json] body of an item, list bucket entries, get versions of an s3 object ,get tags of an s3 object, get first body, get previous body */
const { Util } = require('@hawryschuk/common');
const s3WaitForRetry = 5;
const s3WaitForDelaySeconds = 1;
const AWSHelper = require('./aws.helper');
module.exports = class {
  /** Allow Buckets to be assigned a profile: @example addProfile({Bucket: 'xxx', profile:'ondemand-dev'}) */
  static get profiles() { return (this._profiles = this._profiles || []); }
  static addProfile({ Bucket, profile }) { this.profiles.push({ Bucket, name: profile }); }
  static s3(Bucket) {                                                           // Get the proper AWS::S3 instance for the Bucket (if the Bucket is registered to profile)
    AWSHelper.profile = (Util.findWhere(this.profiles, { Bucket }) || {}).name; // - Switch to the Bucket's profile (if there is one)
    return AWSHelper.S3;                                                        // - Get the AWS::S3 instance for the current profile
  }

  /** Whether the specified bucket exists */
  static exists({ Bucket, Key }) {
    return (Key
      ? this.s3(Bucket).headObject({ Bucket, Key })
      : this.s3(Bucket).headBucket({ Bucket })
    ).promise().then(() => true).catch(() => false);
  }

  /** Get the parsed-JSON contents of an S3-Bucket Object */
  static async get({ Bucket, Key, VersionId }) {
    const Body = (await this.s3(Bucket).getObject({ Bucket, Key, VersionId }).promise()).Body.toString('utf8');
    return Util.safely(() => JSON.parse(Body), Body);
  }

  /** Get the etag of an item */
  static async getETag({ Bucket, Key }) { return (await this.s3(Bucket).getObject({ Bucket, Key }).promise()).ETag.replace(/"/g, ''); }

  /** Get the ObjectTagging of an item */
  static async getObjectTagging({ Bucket, Key, VersionId, Tag }) {
    const { TagSet } = (await this.s3(Bucket).getObjectTagging({ Bucket, Key, VersionId }).promise()) || {};
    return Tag ? (Util.findWhere(TagSet || [], { Key: Tag }) || {}).Value : TagSet || [];
  }

  /** Get the versions of an s3 object, or objects matching the prefix */
  static async getVersions({ Bucket, Prefix, Key, IncludeDeleteMarkers }) {
    const versions = []; let KeyMarker;
    do {
      const { Versions, DeleteMarkers, NextKeyMarker } = await this.s3(Bucket).listObjectVersions({ KeyMarker, Bucket, Prefix: Prefix || Key }).promise();
      KeyMarker = NextKeyMarker;
      versions.push(...(IncludeDeleteMarkers ? [...Versions, ...DeleteMarkers.map(o => ({ ...o, DeletionMarker: true }))] : Versions).filter(v => !Key || v.Key === Key));
    } while (KeyMarker);
    return versions;
  }
  /** Get the first version of an object */
  static async getFirstVersion({ Bucket, Key }) {
    const versions = await this.getVersions({ Bucket, Key });
    return await this.get({ Bucket, Key, VersionId: versions[versions.length - 1].VersionId });
  };

  /** Get the previous version of an object */
  static async getPreviousVersion({ Bucket, Key, VersionId }) {
    const versions = await this.getVersions({ Bucket, Key });
    if (!VersionId) VersionId = versions[0]; // default version is the current version (so get the version previous to that)
    const index = versions.findIndex(v => v.VersionId === VersionId);
    if (index < 0) throw new Error(`Invalid Version`);
    const previous = versions[index + 1];
    if (!previous) throw new Error(`No previous version`);
    return await this.get({ Bucket, Key, VersionId: previous.VersionId });
  }

  /** Delete an object in an s3 bucket */
  static async remove({ Bucket, Key, VersionId, Objects }) {
    if (Objects) {
      const _self = this;
      while (Objects.length) {  // [we don't use] deleteObjects [because it] will leave a version behind with a DeletionMarker
        console.log(`Objects remaining: ${Objects.length}`);
        await Promise.all(Objects.splice(0, 50).map(obj => _self.remove({ Bucket, ...obj })));
      }
    } else {                    // deleteObject will remove the version without a DeletionMarker
      await this.s3(Bucket).deleteObject({ Bucket, Key, VersionId }).promise();
    }
  }

  /** Put object in s3 bucket and wait until its propogated in bucket */
  static async put({ Bucket, Key, Body, Tagging, TagSet, Tags }) {
    if (Tags) TagSet = Object.entries(Tags).map(([Key, Value]) => ({ Key, Value }));
    if (TagSet) Tagging = TagSet.map(({ Key, Value }) => `${Key}=${encodeURIComponent(Value)}`).join('&');
    if (typeof Body !== 'string') Body = JSON.stringify(Body);
    await (this.s3(Bucket).putObject({ Bucket, Key, Body, ContentType: 'application/json', Tagging }).promise());
    await this.s3(Bucket).waitFor('objectExists', { Bucket, Key, $waiter: { maxAtempts: s3WaitForRetry, delay: s3WaitForDelaySeconds } }).promise();
    console.log(`(S3Helper.put) Key '${Key}' exists in bucket`);
  };

  /** Update the contents of an S3-Bucket Object and wait until its propogated in bucket */
  static async update({ Bucket, Key, Body, Tagging, TagSet, Tags }) {
    if (!TagSet && !Tagging && !Tags) Tags = await this.getTags({ Bucket, Key });
    await this.put({ Bucket, Key, Body, Tagging, TagSet, Tags });
  };

  /** Get all the keys in a bucket : @fixed previous wouldnt return all keys , just up to 1000 keys */
  static async getKeys({ Bucket, MaxKeys = 1000, ContinuationToken, items = [], Prefix }) {
    do {
      const { NextContinuationToken, Contents } = await this.s3(Bucket).listObjectsV2({ Bucket, ContinuationToken, MaxKeys, Prefix }).promise();
      ContinuationToken = NextContinuationToken;
      items.push(...Util.pluck(Contents, 'Key'));
    } while (ContinuationToken);
    return items;
  }

  /** Get the tags of the s3 object : @returns: { [key:string]:string } */
  static async getTags({ Bucket, Key, VersionId }) {
    return (await this.getObjectTagging({ Bucket, Key, VersionId }))
      .reduce((tags, { Key, Value }) => ({ ...tags, [Key]: Value }), {});
  }

  /** Empty a s3 bucket / delete all versions / IncludeDeleteMarkers */
  static async emptyBucket({ Bucket }) {
    const Objects = await this.getVersions({ Bucket, IncludeDeleteMarkers: true });
    if (Objects.length) console.log(`------Deleting '${Objects.length}' objects in the Bucket '${Bucket}'`);
    await this.remove({ Bucket, Objects });
  }
};
