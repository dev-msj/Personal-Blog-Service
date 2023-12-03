import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PostLikeEntity } from '../entities/post-like.entity';
import { PostLikeDao } from '../dao/post-like.dao';
import { PostLikeDto } from '../dto/post-like.dto';
import { CacheIdUtils } from '../../utils/cache-id.utils';
import { TimeUtils } from '../../utils/time.utills';

@Injectable()
export class PostLikeRepository {
  constructor(
    @InjectRepository(PostLikeEntity)
    private readonly postLikeRepository: Repository<PostLikeEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findPostLikeDaoList(postId: number): Promise<PostLikeDao[]> {
    return (
      await this.postLikeRepository.find({
        where: { postId: postId },
        cache: {
          id: CacheIdUtils.getPostLikeEntityListCacheId(postId),
          milliseconds: TimeUtils.getTicTimeHMS(24),
        },
      })
    ).map((postLikeEntiy) => PostLikeDao.from({ ...postLikeEntiy }));
  }

  async savePostLikeDto(postLikeDto: PostLikeDto): Promise<void> {
    await this.removePostLikeEntityListCache(postLikeDto.postId);

    await this.postLikeRepository.save(
      PostLikeDao.from({ ...postLikeDto }).toPostLikeEntity(),
    );
  }

  async removePostLikeDto(postLikeDto: PostLikeDto): Promise<void> {
    await this.removePostLikeEntityListCache(postLikeDto.postId);

    await this.postLikeRepository.remove(
      PostLikeDao.from({ ...postLikeDto }).toPostLikeEntity(),
    );
  }

  private async removePostLikeEntityListCache(postId: number) {
    await this.dataSource.queryResultCache.remove([
      CacheIdUtils.getPostLikeEntityListCacheId(postId),
    ]);
  }
}
