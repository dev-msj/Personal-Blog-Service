import { Inject, Injectable } from '@nestjs/common';
import { UserInfoService } from '../../user/service/user-info.service';
import { PostLikeDto } from '../dto/post-like.dto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { PostLikeRepository } from '../repository/post-like.repository';
import { PostLikeEntity } from '../entities/post-like.entity';
import { PostLikeDao } from '../dao/post-like.dao';

@Injectable()
export class PostLikeService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
    private readonly postLikeRepository: PostLikeRepository,
    private readonly userInfoService: UserInfoService,
  ) {}

  async getPostLikeNicknameList(postId: number): Promise<string[]> {
    return await this.getNicknameList(
      await this.postLikeRepository.findPostLikeEntityList(postId),
    );
  }

  async addPostLikeUser(postLikeDto: PostLikeDto): Promise<void> {
    this.logger.info(`addPostLikeUser - [${JSON.stringify(postLikeDto)}]`);

    await this.postLikeRepository.savePostLikeEntity(
      PostLikeDao.from({ ...postLikeDto }).toPostLikeEntity(),
    );
  }

  async removePostLikeUser(postLikeDto: PostLikeDto): Promise<void> {
    this.logger.info(`removePostLikeUser - [${JSON.stringify(postLikeDto)}]`);

    await this.postLikeRepository.removePostLikeDto(
      PostLikeDao.from({ ...postLikeDto }).toPostLikeEntity(),
    );
  }

  private async getNicknameList(
    postLikeEntityList: PostLikeEntity[],
  ): Promise<string[]> {
    const nicknameList = [];
    for (const postLikeEntity of postLikeEntityList) {
      nicknameList.push(
        (await this.userInfoService.getUserInfoDto(postLikeEntity.uid))
          .nickname,
      );
    }

    return nicknameList;
  }
}
