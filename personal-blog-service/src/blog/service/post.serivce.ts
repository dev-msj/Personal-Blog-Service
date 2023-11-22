import { Injectable } from '@nestjs/common';
import { PostEntity } from '../entities/post.entity';
import { LessThanOrEqual, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PostDto } from '../dto/post.dto';
import { PostDao } from '../dao/post.dao';
import { PostLikeEntity } from '../entities/post-like.entity';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(PostEntity)
    private readonly postRrepository: Repository<PostEntity>,
    @InjectRepository(PostLikeEntity)
    private readonly postLikeRrepository: Repository<PostLikeEntity>,
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
      relations: ['postLikeEntitys'],
    });

    return postEntityList.map((postEntity) =>
      PostDao.fromPostEntity(postEntity).toPostDto(),
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
}
