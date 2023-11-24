import { Inject, Injectable } from '@nestjs/common';
import { PostEntity } from '../entities/post.entity';
import { LessThanOrEqual, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PostDto } from '../dto/post.dto';
import { PostDao } from '../dao/post.dao';
import { PostLikeService } from './post-like.serivce';
import authConfig from 'src/config/authConfig';
import { ConfigType } from '@nestjs/config';

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
    postId: number = -1,
  ): Promise<PostDto[]> {
    if (postId < 0) {
      postId = await this.getMaxPostId(authUid);
    }

    const postEntityList = await this.postRrepository.find({
      where: { postUid: authUid, postId: LessThanOrEqual(postId) },
      take: 20,
      order: { postId: 'DESC' },
    });

    const postDaoList = postEntityList.map((postEntity) =>
      PostDao.fromPostEntity(postEntity),
    );

    await this.setPostLikeUidList(postDaoList);

    return postDaoList.map((postDao) =>
      postDao.toPostDto(this.config.pkSecretKey),
    );
  }

  private async getMaxPostId(authUid: string): Promise<number> {
    return (
      await this.postRrepository
        .createQueryBuilder('postEntity')
        .select('MAX(postEntity.postId)', 'max')
        .where('postEntity.postUid = :postUid', { postUid: authUid })
        .getRawOne()
    ).max;
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
