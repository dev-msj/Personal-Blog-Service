import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PostEntity } from '../entities/post.entity';
import { Repository } from 'typeorm';
import { PaginationUtils } from '../../utils/pagination.utils';
import { CacheIdUtils } from '../../utils/cache-id.utils';
import { TimeUtils } from '../../utils/time.utils';
import { PostPageDto } from '../dto/post-page.dto';
import { CreatePostDto } from '../dto/create-post.dto';

@Injectable()
export class PostRepository {
  constructor(
    @InjectRepository(PostEntity)
    private readonly postRepository: Repository<PostEntity>,
  ) {}

  async createPost(authUid: string, createPostDto: CreatePostDto) {
    await this.postRepository.insert(
      this.postRepository.create({
        postUid: authUid,
        ...createPostDto,
      }),
    );
  }

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

  async findPostEntityListAndCountByPostPageDto(
    postPageDto: PostPageDto,
  ): Promise<[PostEntity[], number]> {
    const [postEntityList, count] = await this.postRepository.findAndCount({
      where: { postUid: postPageDto.postUid },
      take: PaginationUtils.TAKE,
      skip: (postPageDto.page - 1) * PaginationUtils.TAKE,
      order: { postId: 'DESC' },
      cache: {
        id: CacheIdUtils.getPostEntityListByPostPageDtoCacheId(postPageDto),
        milliseconds: TimeUtils.getTicTimeHMS(24),
      },
    });

    return [postEntityList, count];
  }
}
