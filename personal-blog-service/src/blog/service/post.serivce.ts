import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import authConfig from '../../config/authConfig';
import { PostLikeService } from './post-like.serivce';
import { PostRepository } from '../repository/post.repository';
import { PostDto } from '../dto/post.dto';
import { PostPageRequestDto } from '../dto/post-page-request.dto';
import { PostPageDto } from '../dto/post-page.dto';
import { PaginationDto } from '../dto/pagination.dto';
import { PostDao } from '../dao/post.dao';
import { PostEntity } from '../entities/post.entity';
import { PaginationUtils } from '../../utils/pagination.utils';
import { CryptoUtils } from '../../utils/crypto.utils';

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
      await this.postRepository.findPostEntityListAndCountByPostPageDto(
        new PostPageDto(
          CryptoUtils.decryptPrimaryKey(
            postPageRequestDto.encryptedPostUid,
            this.config.pkSecretKey,
          ),
          postPageRequestDto.page,
        ),
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
