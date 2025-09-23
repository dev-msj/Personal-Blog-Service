import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { UserInfoService } from '../../user/service/user-info.service';
import { PostLikeRepository } from '../repository/post-like.repository';
import { PostLikeEntity } from '../entities/post-like.entity';
import { PostLikeDao } from '../dao/post-like.dao';
import { PostLikeDto } from '../dto/post-like.dto';
import { CryptoUtils } from '../../utils/crypto.utils';
import authConfig from '../../config/authConfig';

@Injectable()
export class PostLikeService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
    private readonly postLikeRepository: PostLikeRepository,
    private readonly userInfoService: UserInfoService,
  ) {}

  async getPostLikeNicknameList(postId: number): Promise<string[]> {
    return await this.getNicknameList(
      await this.postLikeRepository.findPostLikeEntityList(postId),
    );
  }

  async addPostLikeUser(postLikeDto: PostLikeDto): Promise<void> {
    const postLikeEntity = this.getPostLikeEntity(postLikeDto);
    const isExist = await this.postLikeRepository.isExist(postLikeEntity);
    if (isExist) {
      throw new ConflictException('PostId is already exist!');
    }

    await this.postLikeRepository.savePostLikeEntity(postLikeEntity);

    this.logger.info(`addPostLikeUser - [${JSON.stringify(postLikeDto)}]`);
  }

  async removePostLikeUser(postLikeDto: PostLikeDto): Promise<void> {
    const postLikeEntity = this.getPostLikeEntity(postLikeDto);
    const isExist = this.postLikeRepository.isExist(postLikeEntity);
    if (!isExist) {
      throw new ConflictException('PostId does not exist!');
    }

    await this.postLikeRepository.removePostLikeDto(postLikeEntity);

    this.logger.info(`removePostLikeUser - [${JSON.stringify(postLikeDto)}]`);
  }

  private getPostLikeEntity(postLikeDto: PostLikeDto): PostLikeEntity {
    return PostLikeDao.from({
      postId: Number(
        CryptoUtils.decryptPrimaryKey(
          postLikeDto.encryptedPostId,
          this.config.pkSecretKey,
        ),
      ),
      uid: postLikeDto.uid,
    }).toPostLikeEntity();
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
