import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PostEntity } from '../entities/post.entity';
import { Repository } from 'typeorm';
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

  async findPostEntityListAndCountByPage(
    page: number,
  ): Promise<[PostEntity[], number]> {
    const [postEntityList, count] = await this.postRepository.findAndCount({
      take: PaginationUtils.TAKE,
      skip: (page - 1) * PaginationUtils.TAKE,
      order: { postId: 'DESC' },
      cache: {
        id: CacheIdUtils.getPostEntityListByPageCacheId(page),
        milliseconds: TimeUtils.getTicTimeMS(5),
      },
    });

    return [postEntityList, count];
  }

  async findPostEntityListAndCountByPostPageRequestDto(
    postPageRequestDto: PostPageRequestDto,
  ): Promise<[PostEntity[], number]> {
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

    return [postEntityList, count];
  }
}
