import { Inject, Injectable } from '@nestjs/common';
import { PostEntity } from '../entities/post.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PostDto } from '../dto/post.dto';
import { PostDao } from '../dao/post.dao';
import { PostLikeService } from './post-like.serivce';
import authConfig from 'src/config/authConfig';
import { ConfigType } from '@nestjs/config';
import { PaginationDto } from '../dto/pagination.dto';
import { PaginationUtils } from 'src/utils/pagination.utils';

@Injectable()
export class PostService {
  constructor(
    @Inject(authConfig.KEY)
    private config: ConfigType<typeof authConfig>,
    @InjectRepository(PostEntity)
    private readonly postRrepository: Repository<PostEntity>,
    private readonly postLikeService: PostLikeService,
  ) {}

  async getPostDtoList(
    authUid: string,
    page: number = 1,
  ): Promise<PaginationDto<PostDto>> {
    const [postEntityList, total] = await this.postRrepository.findAndCount({
      where: { postUid: authUid },
      take: PaginationUtils.TAKE,
      skip: (page - 1) * PaginationUtils.TAKE,
      order: { postId: 'DESC' },
    });

    const postDaoList = postEntityList.map((postEntity) =>
      PostDao.fromPostEntity(postEntity),
    );

    await this.setPostLikeUidList(postDaoList);

    return PaginationUtils.toPaginationDto<PostDto>(
      postDaoList.map((postDao) => postDao.toPostDto(this.config.pkSecretKey)),
      total,
      page,
    );
  }

  private async getMaxPostId(authUid: string): Promise<number> {
    return (
      (
        await this.postRrepository
          .createQueryBuilder('postEntity')
          .select('MAX(postEntity.postId)', 'max')
          .where('postEntity.postUid = :postUid', { postUid: authUid })
          .getRawOne()
      ).max || 0
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
