import { Injectable } from '@nestjs/common';
import { PostEntity } from '../entities/post.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PostDto } from '../dto/post.dto';
import { PostDao } from '../dao/post.dao';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(PostEntity)
    private readonly postRrepository: Repository<PostEntity>,
  ) {}

  async getPostDtoList(): Promise<PostDto[]> {
    const postEntityList = await this.postRrepository.find({
      where: { postUid: 'asdf' },
      take: 20,
      order: { postId: 'DESC' },
    });

    return postEntityList.map((postEntity) =>
      PostDao.fromPostEntity(postEntity).toPostDto(),
    );
  }
}
