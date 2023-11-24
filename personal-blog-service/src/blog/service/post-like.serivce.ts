import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PostLikeEntity } from '../entities/post-like.entity';
import authConfig from 'src/config/authConfig';
import { ConfigType } from '@nestjs/config';
import { UserInfoService } from 'src/user/service/user-info.service';

@Injectable()
export class PostLikeService {
  constructor(
    @Inject(authConfig.KEY)
    private config: ConfigType<typeof authConfig>,
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
}
