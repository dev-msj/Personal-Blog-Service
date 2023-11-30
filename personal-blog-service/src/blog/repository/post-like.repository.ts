import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PostLikeEntity } from '../entities/post-like.entity';
import { PostLikeDao } from '../dao/post-like.dao';
import { PostLikeDto } from '../dto/post-like.dto';

@Injectable()
export class PostLikeRepository {
  constructor(
    @InjectRepository(PostLikeEntity)
    private readonly postLikeRepository: Repository<PostLikeEntity>,
  ) {}

  async findPostLikeDaoList(
    postUid: string,
    postId: number,
  ): Promise<PostLikeDao[]> {
    return (
      await this.postLikeRepository.find({
        where: { postUid: postUid, postId: postId },
      })
    ).map((postLikeEntiy) => PostLikeDao.fromPostLikeEntity(postLikeEntiy));
  }

  async savePostLikeDto(postLikeDto: PostLikeDto): Promise<void> {
    await this.postLikeRepository.save(
      PostLikeDao.fromPostLikeDto(postLikeDto).toPostLikeEntity(),
    );
  }

  async removePostLikeDto(postLikeDto: PostLikeDto): Promise<void> {
    await this.postLikeRepository.remove(
      PostLikeDao.fromPostLikeDto(postLikeDto).toPostLikeEntity(),
    );
  }
}
