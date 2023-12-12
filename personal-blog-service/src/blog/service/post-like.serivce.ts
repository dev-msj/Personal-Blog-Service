import { ConflictException, Inject, Injectable } from '@nestjs/common';
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
    const isExist = this.postLikeRepository.isExist(
      PostLikeDao.from({ ...postLikeDto }).toPostLikeEntity(),
    );
    if (isExist) {
      throw new ConflictException('PostId is already exist!');
    }

    await this.postLikeRepository.savePostLikeEntity(
      PostLikeDao.from({ ...postLikeDto }).toPostLikeEntity(),
    );

    this.logger.info(`addPostLikeUser - [${JSON.stringify(postLikeDto)}]`);
  }

  async removePostLikeUser(postLikeDto: PostLikeDto): Promise<void> {
    const isExist = this.postLikeRepository.isExist(
      PostLikeDao.from({ ...postLikeDto }).toPostLikeEntity(),
    );
    if (!isExist) {
      throw new ConflictException('PostId does not exist!');
    }

    await this.postLikeRepository.removePostLikeDto(
      PostLikeDao.from({ ...postLikeDto }).toPostLikeEntity(),
    );

    this.logger.info(`removePostLikeUser - [${JSON.stringify(postLikeDto)}]`);
  }

  private async getNicknameList(
    postLikeEntityList: PostLikeEntity[],
  ): Promise<string[]> {
    const nicknameList = [];
    for (const postLikeEntity of postLikeEntityList) {
      nicknameList.push(
        (await this.userInfoService.getUserInfoByUid(postLikeEntity.uid))
          .nickname,
      );
    }

    return nicknameList;
  }
}
