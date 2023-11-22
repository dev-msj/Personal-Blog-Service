import { Injectable } from '@nestjs/common';
import { PostEntity } from '../entities/post.entity';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PostDto } from '../dto/post.dto';
import { PostDao } from '../dao/post.dao';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(PostEntity)
    private readonly postRrepository: Repository<PostEntity>,
  ) {}

  async getPostDtoList(
    authUid: string,
    postId: number = 0,
  ): Promise<PostDto[]> {
    const postEntityList = await this.postRrepository.find({
      where: { postUid: authUid, postId: MoreThanOrEqual(postId) },
      take: 20,
      order: { postId: 'DESC' },
    });

    return postEntityList.map((postEntity) =>
      PostDao.fromPostEntity(postEntity).toPostDto(),
    );
  }
}
