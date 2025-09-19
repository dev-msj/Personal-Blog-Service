import { PostPageDto } from '../blog/dto/post-page.dto';

export class CacheIdUtils {
  static getPostEntityListByPageCacheId(page: number) {
    return `getPostEntityListByPage_${page}`;
  }

  static getPostEntityListByPostPageDtoCacheId(postPageDto: PostPageDto) {
    return `getPostEntityListByPostPageDto_${postPageDto.postUid}_${postPageDto.page}`;
  }

  static getPostLikeEntityListCacheId(postId: number) {
    return `PostLikeEntityList_${postId}`;
  }

  static getUserInfoEntityCacheId(uid: string) {
    return `UserInfoEntity_${uid}`;
  }

  static getUserAuthEntityCacheId(uid: string) {
    return `UserAuthEntity_${uid}`;
  }

  static getUserSessionEntityCacheId(uid: string) {
    return `UserSessionEntity_${uid}`;
  }
}
