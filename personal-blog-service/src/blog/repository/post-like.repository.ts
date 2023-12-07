import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PostLikeEntity } from '../entities/post-like.entity';
import { PostLikeDao } from '../dao/post-like.dao';
import { CacheIdUtils } from '../../utils/cache-id.utils';
import { TimeUtils } from '../../utils/time.utills';

@Injectable()
export class PostLikeRepository {
  constructor(
    @InjectRepository(PostLikeEntity)
    private readonly postLikeRepository: Repository<PostLikeEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findPostLikeEntityList(postId: number): Promise<PostLikeEntity[]> {
    return await this.postLikeRepository.find({
      where: { postId: postId },
      cache: {
        id: CacheIdUtils.getPostLikeEntityListCacheId(postId),
        milliseconds: TimeUtils.getTicTimeHMS(24),
      },
    });
  }

  async savePostLikeEntity(postLikeEntity: PostLikeEntity): Promise<void> {
    await this.removePostLikeEntityListCache(postLikeEntity.postId);

    await this.postLikeRepository.save(
      PostLikeDao.from({ ...postLikeEntity }).toPostLikeEntity(),
    );
  }

  async removePostLikeDto(postLikeEntity: PostLikeEntity): Promise<void> {
    await this.removePostLikeEntityListCache(postLikeEntity.postId);

    await this.postLikeRepository.remove(
      PostLikeDao.from({ ...postLikeEntity }).toPostLikeEntity(),
    );
  }

  private async removePostLikeEntityListCache(postId: number) {
    await this.dataSource.queryResultCache.remove([
      CacheIdUtils.getPostLikeEntityListCacheId(postId),
    ]);
  }
}
