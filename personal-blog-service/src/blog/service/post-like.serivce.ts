import { Inject, Injectable } from '@nestjs/common';
import { UserInfoService } from 'src/user/service/user-info.service';
import { PostLikeDto } from '../dto/post-like.dto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { PostLikeRepository } from '../repository/post-like.repository';
import { PostLikeDao } from '../dao/post-like.dao';

@Injectable()
export class PostLikeService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
    private readonly postLikeRepository: PostLikeRepository,
    private readonly userInfoService: UserInfoService,
  ) {}

  async getPostLikeNicknameList(
    postUid: string,
    postId: number,
  ): Promise<string[]> {
    const postLikeDaoList = await this.postLikeRepository.findPostLikeDaoList(
      postUid,
      postId,
    );

    return this.getNicknameList(postLikeDaoList);
  }

  async addPostLikeUser(postLikeDto: PostLikeDto) {
    await this.postLikeRepository.savePostLikeDto(postLikeDto);
  }

  async removePostLikeUser(postLikeDto: PostLikeDto) {
    await this.postLikeRepository.removePostLikeDto(postLikeDto);
  }

  private async getNicknameList(postLikeDaoList: PostLikeDao[]) {
    const nicknameList = [];
    for (const postLikeDao of postLikeDaoList) {
      const userInfo = await this.userInfoService.getUserInfoDto(
        postLikeDao.getUid,
      );

      nicknameList.push(userInfo.nickname);
    }

    return nicknameList;
  }
}
