import { PostPageRequestDto } from '../blog/dto/post-page-request.dto';

export class CacheIdUtils {
  static getPostEntityListByPostPageRequestDtoCacheId(
    PostPageRequestDto: PostPageRequestDto,
  ) {
    return `getPostEntityListByPostPageRequestDto_${PostPageRequestDto.postUid}_${PostPageRequestDto.page}`;
  }

  static getPostLikeEntityListCacheId(postUid: string, postId: number) {
    return `PostLikeEntityList_${postUid}_${postId}`;
  }

  static getUserInfoEntityCacheId(uid: string) {
    return `UserInfoEntity_${uid}`;
  }
}
