import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PostEntity } from '../entities/post.entity';
import { Repository } from 'typeorm';
import { PostDao } from '../dao/post.dao';
import { PaginationUtils } from '../../utils/pagination.utils';
import { CacheIdUtils } from '../../utils/cache-id.utils';
import { TimeUtils } from '../../utils/time.utills';
import { PostPageRequestDto } from '../dto/post-page-request.dto';

@Injectable()
export class PostRepository {
  constructor(
    @InjectRepository(PostEntity)
    private readonly postRepository: Repository<PostEntity>,
  ) {}

  async findPostDaoListAndCountByPage(
    page: number,
  ): Promise<[PostDao[], number]> {
    const [postEntityList, count] = await this.postRepository.findAndCount({
      take: PaginationUtils.TAKE,
      skip: (page - 1) * PaginationUtils.TAKE,
      order: { postId: 'DESC' },
      cache: {
        id: CacheIdUtils.getPostEntityListByPageCacheId(page),
        milliseconds: TimeUtils.getTicTimeMS(5),
      },
    });

    return [
      postEntityList.map((postEntity) => PostDao.from({ ...postEntity })),
      count,
    ];
  }

  async findPostDaoListAndCountByPostPageRequestDto(
    postPageRequestDto: PostPageRequestDto,
  ): Promise<[PostDao[], number]> {
    const [postEntityList, count] = await this.postRepository.findAndCount({
      where: { postUid: postPageRequestDto.postUid },
      take: PaginationUtils.TAKE,
      skip: (postPageRequestDto.page - 1) * PaginationUtils.TAKE,
      order: { postId: 'DESC' },
      cache: {
        id: CacheIdUtils.getPostEntityListByPostPageRequestDtoCacheId(
          postPageRequestDto,
        ),
        milliseconds: TimeUtils.getTicTimeHMS(24),
      },
    });

    return [
      postEntityList.map((postEntity) => PostDao.from({ ...postEntity })),
      count,
    ];
  }

  async getMaxPostId(postUid: string): Promise<number> {
    return (
      (
        await this.postRepository
          .createQueryBuilder('postEntity')
          .select('MAX(postEntity.postId)', 'max')
          .where('postEntity.postUid = :postUid', { postUid: postUid })
          .getRawOne()
      ).max || 0
    );
  }
}
