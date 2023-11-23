import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PostLikeEntity } from '../entities/post-like.entity';
import { AES } from 'crypto-js';
import authConfig from 'src/config/authConfig';
import { ConfigType } from '@nestjs/config';

@Injectable()
export class PostLikeService {
  constructor(
    @Inject(authConfig.KEY)
    private config: ConfigType<typeof authConfig>,
    @InjectRepository(PostLikeEntity)
    private readonly postLikeRrepository: Repository<PostLikeEntity>,
  ) {}

  async getPostLikeUidList(postUid: string, postId: number): Promise<string[]> {
    const postLikeEntityList = await this.postLikeRrepository.find({
      where: { postUid: postUid, postId: postId },
    });

    return postLikeEntityList.map((postLikeEntity) =>
      AES.encrypt(postLikeEntity.uid, this.config.pkSecretKey).toString(),
    );
  }
}
