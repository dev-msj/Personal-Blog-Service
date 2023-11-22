import { Injectable } from '@nestjs/common';
import { PostEntity } from '../entities/post.entity';
import { MoreThanOrEqual, Repository } from 'typeorm';
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
    postId: number = 0,
  ): Promise<PostDto[]> {
    const postEntityList = await this.postRrepository.find({
      where: { postUid: authUid, postId: MoreThanOrEqual(postId) },
      take: 20,
      order: { postId: 'DESC' },
      relations: ['postLikeEntitys'],
    });

    return postEntityList.map((postEntity) =>
      PostDao.fromPostEntity(postEntity).toPostDto(),
    );
  }
}
