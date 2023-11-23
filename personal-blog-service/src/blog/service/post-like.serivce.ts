import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PostLikeEntity } from '../entities/post-like.entity';

@Injectable()
export class PostLikeService {
  constructor(
    @InjectRepository(PostLikeEntity)
    private readonly postLikeRrepository: Repository<PostLikeEntity>,
  ) {}

  async getPostLikeUidList(postUid: string, postId: number): Promise<string[]> {
    const postLikeEntityList = await this.postLikeRrepository.find({
      where: { postUid: postUid, postId: postId },
    });

    return postLikeEntityList.map((postLikeEntity) => postLikeEntity.uid);
  }
}
