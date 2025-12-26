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

  async getPostLikeMapByPostIds(
    postIds: number[],
  ): Promise<Map<number, string[]>> {
    const postLikeEntities =
      await this.postLikeRepository.findPostLikeEntitiesByPostIds(postIds);

    const postLikeMap = new Map<number, string[]>();

    // 초기화: 모든 postId에 대해 빈 배열 설정
    postIds.forEach((postId) => postLikeMap.set(postId, []));

    // postId별로 그룹화
    const groupedByPostId = new Map<number, PostLikeEntity[]>();
    postLikeEntities.forEach((entity) => {
      if (!groupedByPostId.has(entity.postId)) {
        groupedByPostId.set(entity.postId, []);
      }
      groupedByPostId.get(entity.postId).push(entity);
    });

    // 각 그룹에 대해 닉네임 목록 조회
    for (const [postId, entities] of groupedByPostId) {
      const nicknames = await this.getNicknameList(entities);
      postLikeMap.set(postId, nicknames);
    }

    return postLikeMap;
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
    const isExist = await this.postLikeRepository.isExist(postLikeEntity);
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
