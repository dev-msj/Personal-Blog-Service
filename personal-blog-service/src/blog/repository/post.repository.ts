import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PostEntity } from '../entities/post.entity';
import { Repository } from 'typeorm';
import { PaginationUtils } from 'src/utils/pagination.utils';
import { TimeUtils } from 'src/utils/time.utills';

@Injectable()
export class PostRepository {
  constructor(
    @InjectRepository(PostEntity)
    private readonly postRepository: Repository<PostEntity>,
  ) {}

  async findPostEntityListAndCount(
    postUid: string,
    page: number,
  ): Promise<[PostEntity[], number]> {
    return await this.postRepository.findAndCount({
      where: { postUid: postUid },
      take: PaginationUtils.TAKE,
      skip: (page - 1) * PaginationUtils.TAKE,
      order: { postId: 'DESC' },
      // create/update/delete 할 때 캐시를 어떻게 처리할 것인지 고민해보기
      cache: {
        id: `getPostDtoList_${postUid}_${page}`,
        milliseconds: TimeUtils.getTicTimeHMS(24),
      },
    });
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
