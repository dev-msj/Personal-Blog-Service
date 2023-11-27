import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PostLikeEntity } from '../entities/post-like.entity';
import { UserInfoService } from 'src/user/service/user-info.service';
import { PostLikeDto } from '../dto/post-like.dto';
import { PostLikeDao } from '../dao/post-like.dao';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class PostLikeService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
    @InjectRepository(PostLikeEntity)
    private readonly postLikeRrepository: Repository<PostLikeEntity>,
    private readonly userInfoService: UserInfoService,
  ) {}

  async getPostLikeNicknameList(
    postUid: string,
    postId: number,
  ): Promise<string[]> {
    const postLikeEntityList = await this.postLikeRrepository.find({
      where: { postUid: postUid, postId: postId },
    });

    return this.getNicknameList(postLikeEntityList);
  }

  private async getNicknameList(postLikeEntityList: PostLikeEntity[]) {
    const nicknameList = [];
    for (const userInfoEntity of postLikeEntityList) {
      const userInfo = await this.userInfoService.getUserInfoDto(
        userInfoEntity.uid,
      );

      nicknameList.push(userInfo.nickname);
    }

    return nicknameList;
  }

  async addPostLikeUser(postLikeDto: PostLikeDto) {
    await this.postLikeRrepository.save(
      PostLikeDao.fromPostLikeDto(postLikeDto).toPostLikeEntity(),
    );
  }

  async removePostLikeUser(postLikeDto: PostLikeDto) {
    await this.postLikeRrepository.remove(
      PostLikeDao.fromPostLikeDto(postLikeDto).toPostLikeEntity(),
    );
  }
}
