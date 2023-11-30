import { Inject, Injectable } from '@nestjs/common';
import { PostDto } from '../dto/post.dto';
import { PostDao } from '../dao/post.dao';
import { PostLikeService } from './post-like.serivce';
import authConfig from 'src/config/authConfig';
import { ConfigType } from '@nestjs/config';
import { PaginationDto } from '../dto/pagination.dto';
import { PaginationUtils } from 'src/utils/pagination.utils';
import { PostRepository } from '../repository/post.repository';

@Injectable()
export class PostService {
  constructor(
    @Inject(authConfig.KEY)
    private config: ConfigType<typeof authConfig>,
    private readonly postRepository: PostRepository,
    private readonly postLikeService: PostLikeService,
  ) {}

  async getPostDtoList(
    authUid: string,
    page: number = 1,
  ): Promise<PaginationDto<PostDto>> {
    const [postDaoList, total] =
      await this.postRepository.findPostDaoListAndCount(authUid, page);

    await this.setPostLikeUidList(postDaoList);

    return PaginationUtils.toPaginationDto<PostDto>(
      postDaoList.map((postDao) => postDao.toPostDto(this.config.pkSecretKey)),
      total,
      page,
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
