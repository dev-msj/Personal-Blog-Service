import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PostEntity } from '../entities/post.entity';
import { Repository } from 'typeorm';
import { PaginationUtils } from '../../utils/pagination.utils';
import { CacheIdUtils } from '../../utils/cache-id.utils';
import { TimeUtils } from '../../utils/time.utils';
import { PostPageDto } from '../dto/post-page.dto';
import { CreatePostDto } from '../dto/create-post.dto';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { PatchPostDto } from '../dto/patch-post.dto';

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

  async updatePost(
    postUid: string,
    decryptedPostId: number,
    patchPostDto: PatchPostDto,
  ): Promise<void> {
    const { title, contents } = patchPostDto;

    // readonly 속성 때문에 직접 대입 시 에러 발생
    const updateData = {
      ...(title !== undefined && { title }),
      ...(contents !== undefined && { contents }),
    } as QueryDeepPartialEntity<PostEntity>;

    if (Object.keys(updateData).length === 0) {
      return;
    }

    await this.postRepository.update(
      { postId: decryptedPostId, postUid },
      updateData,
    );
  }

  async deletePost(postUid: string, decryptedPostId: number): Promise<void> {
    await this.postRepository.delete({ postId: decryptedPostId, postUid });
  }
}
