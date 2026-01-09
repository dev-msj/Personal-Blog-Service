import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserInfoEntity } from '../entities/user-info.entity';
import { DataSource, EntityNotFoundError, Repository } from 'typeorm';
import { CacheIdUtils } from '../../utils/cache-id.utils';
import { TimeUtils } from '../../utils/time.utils';

@Injectable()
export class UserInfoRepository {
  constructor(
    @InjectRepository(UserInfoEntity)
    private readonly userInfoRepository: Repository<UserInfoEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async isExist(uid: string): Promise<boolean> {
    return await this.userInfoRepository.exist({ where: { uid: uid } });
  }

  async saveUserInfoEntity(userInfoEntity: UserInfoEntity): Promise<void> {
    await this.userInfoRepository.insert(userInfoEntity);
  }

  async findUserInfoEntity(uid: string): Promise<UserInfoEntity> {
    try {
      return await this.userInfoRepository.findOneOrFail({
        where: { uid },
        cache: {
          id: CacheIdUtils.getUserInfoEntityCacheId(uid),
          milliseconds: TimeUtils.getTicTimeHMS(24),
        },
      });
    } catch (error) {
      await this.removeUserInfoCache(uid);

      if (error instanceof EntityNotFoundError) {
        throw new NotFoundException(`User does not exist! - [${uid}]`);
      }

      throw error;
    }
  }

  async updateUserInfoEntity(userInfoEntity: UserInfoEntity): Promise<void> {
    await this.removeUserInfoCache(userInfoEntity.uid);

    await this.userInfoRepository.update(
      { uid: userInfoEntity.uid },
      userInfoEntity,
    );
  }

  async deleteUserInfoByUid(uid: string): Promise<void> {
    await this.removeUserInfoCache(uid);

    await this.userInfoRepository.delete({ uid: uid });
  }

  private async removeUserInfoCache(uid: string): Promise<void> {
    await this.dataSource.queryResultCache?.remove([
      CacheIdUtils.getUserInfoEntityCacheId(uid),
    ]);
  }
}
