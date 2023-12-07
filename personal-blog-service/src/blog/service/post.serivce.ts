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
import { PostEntity } from '../entities/post.entity';

@Injectable()
export class PostService {
  constructor(
    @Inject(authConfig.KEY)
    private config: ConfigType<typeof authConfig>,
    private readonly postRepository: PostRepository,
    private readonly postLikeService: PostLikeService,
  ) {}

  async getPostPageListByPage(page: number = 1) {
    const [postEntityList, total] =
      await this.postRepository.findPostEntityListAndCountByPage(page);

    const postDaoList = await this.toPostDaoList(postEntityList);

    return PaginationUtils.toPaginationDto<PostDto>(
      postDaoList.map((postDao) => postDao.toPostDto(this.config.pkSecretKey)),
      total,
      page,
    );
  }

  async getPostPageListByPostPageRequestDto(
    postPageRequestDto: PostPageRequestDto,
  ): Promise<PaginationDto<PostDto>> {
    const [postEntityList, total] =
      await this.postRepository.findPostEntityListAndCountByPostPageRequestDto(
        postPageRequestDto,
      );

    const postDaoList = await this.toPostDaoList(postEntityList);

    return PaginationUtils.toPaginationDto<PostDto>(
      postDaoList.map((postDao) => postDao.toPostDto(this.config.pkSecretKey)),
      total,
      postPageRequestDto.page,
    );
  }

  private async toPostDaoList(
    postEntityList: PostEntity[],
  ): Promise<PostDao[]> {
    const postDaoList = postEntityList.map((postEntity) =>
      PostDao.from({ ...postEntity }),
    );

    for (const postDao of postDaoList) {
      postDao.setPostLikeUidList =
        await this.postLikeService.getPostLikeNicknameList(postDao.getPostId);
    }

    return postDaoList;
  }
}
