import { Inject, Injectable } from '@nestjs/common';
import { UserInfoService } from '../../user/service/user-info.service';
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
    return this.getNicknameList(
      await this.postLikeRepository.findPostLikeDaoList(postUid, postId),
    );
  }

  async addPostLikeUser(postLikeDto: PostLikeDto): Promise<void> {
    await this.postLikeRepository.savePostLikeDto(postLikeDto);
  }

  async removePostLikeUser(postLikeDto: PostLikeDto): Promise<void> {
    await this.postLikeRepository.removePostLikeDto(postLikeDto);
  }

  private async getNicknameList(
    postLikeDaoList: PostLikeDao[],
  ): Promise<string[]> {
    const nicknameList = [];
    for (const postLikeDao of postLikeDaoList) {
      nicknameList.push(
        (await this.userInfoService.getUserInfoDto(postLikeDao.getUid))
          .nickname,
      );
    }

    return nicknameList;
  }
}
