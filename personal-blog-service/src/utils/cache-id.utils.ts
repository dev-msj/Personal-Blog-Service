import { PostPageRequestDto } from '../blog/dto/post-page-request.dto';

export class CacheIdUtils {
  static getPostEntityListByPageCacheId(page: number) {
    return `getPostEntityListByPage_${page}`;
  }

  static getPostEntityListByPostPageRequestDtoCacheId(
    PostPageRequestDto: PostPageRequestDto,
  ) {
    return `getPostEntityListByPostPageRequestDto_${PostPageRequestDto.postUid}_${PostPageRequestDto.page}`;
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

  static getUserSessionDtoCacheId(uid: string) {
    return `UserSessionDto_${uid}`;
  }
}
