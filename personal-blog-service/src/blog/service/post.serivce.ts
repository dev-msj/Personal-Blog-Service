import { Inject, Injectable } from '@nestjs/common';
import { PostDto } from '../dto/post.dto';
import { PostDao } from '../dao/post.dao';
import { PostLikeService } from './post-like.serivce';
import { ConfigType } from '@nestjs/config';
import { PaginationDto } from '../dto/pagination.dto';
import { PostRepository } from '../repository/post.repository';
import authConfig from '../../config/authConfig';
import { PaginationUtils } from '../../utils/pagination.utils';
import { PostPageRequestDto } from '../dto/post-page-request.dto';

@Injectable()
export class PostService {
  constructor(
    @Inject(authConfig.KEY)
    private config: ConfigType<typeof authConfig>,
    private readonly postRepository: PostRepository,
    private readonly postLikeService: PostLikeService,
  ) {}

  async getPostPageListByPostPageRequestDto(
    postPageRequestDto: PostPageRequestDto,
  ): Promise<PaginationDto<PostDto>> {
    const [postDaoList, total] =
      await this.postRepository.findPostDaoListAndCountByPostPageRequestDto(
        postPageRequestDto,
      );

    await this.setPostLikeUidList(postDaoList);

    return PaginationUtils.toPaginationDto<PostDto>(
      postDaoList.map((postDao) => postDao.toPostDto(this.config.pkSecretKey)),
      total,
      postPageRequestDto.page,
    );
  }

  private async setPostLikeUidList(postDaoList: PostDao[]) {
    for (const postDao of postDaoList) {
      postDao.setPostLikeUidList =
        await this.postLikeService.getPostLikeNicknameList(
          postDao.getPostUid,
          postDao.getPostId,
        );
    }
  }
}
