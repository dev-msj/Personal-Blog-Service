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

  async findPostLikeDaoList(
    postUid: string,
    postId: number,
  ): Promise<PostLikeDao[]> {
    return (
      await this.postLikeRepository.find({
        where: { postUid: postUid, postId: postId },
        cache: {
          id: CacheIdUtils.getPostLikeEntityListCacheId(postUid, postId),
          milliseconds: TimeUtils.getTicTimeHMS(24),
        },
      })
    ).map((postLikeEntiy) => PostLikeDao.fromPostLikeEntity(postLikeEntiy));
  }

  async savePostLikeDto(postLikeDto: PostLikeDto): Promise<void> {
    await this.removePostLikeEntityListCache(
      postLikeDto.postUid,
      postLikeDto.postId,
    );

    await this.postLikeRepository.save(
      PostLikeDao.fromPostLikeDto(postLikeDto).toPostLikeEntity(),
    );
  }

  async removePostLikeDto(postLikeDto: PostLikeDto): Promise<void> {
    await this.removePostLikeEntityListCache(
      postLikeDto.postUid,
      postLikeDto.postId,
    );

    await this.postLikeRepository.remove(
      PostLikeDao.fromPostLikeDto(postLikeDto).toPostLikeEntity(),
    );
  }

  private async removePostLikeEntityListCache(postUid: string, postId: number) {
    await this.dataSource.queryResultCache.remove([
      CacheIdUtils.getPostLikeEntityListCacheId(postUid, postId),
    ]);
  }
}
