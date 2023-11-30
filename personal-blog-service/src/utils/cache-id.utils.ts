export class CacheIdUtils {
  private static readonly POST_ENTITY_LIST_CACHE_NAME_PREFIX = 'PostEntityList';
  private static readonly POST_LIKE_ENTITY_LIST_CACHE_NAME_PREFIX =
    'PostLikeEntityList';

  static getPostEntityListCacheId(postUid: string, page: number) {
    return `PostEntityList_${postUid}_${page}`;
  }

  static getPostLikeEntityListCacheId(postUid: string, postId: number) {
    return `PostLikeEntityList_${postUid}_${postId}`;
  }

  static getUserInfoEntityCacheId(uid: string) {
    return `UserInfoEntity_${uid}`;
  }
}
