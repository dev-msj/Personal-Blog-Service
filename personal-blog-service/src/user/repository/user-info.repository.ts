import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserInfoEntity } from '../entities/user-info.entity';
import { DataSource, Repository } from 'typeorm';
import { CacheIdUtils } from '../../utils/cache-id.utils';
import { TimeUtils } from '../../utils/time.utills';

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
    await this.userInfoRepository.save(userInfoEntity);
  }

  async findUserInfoEntity(uid: string): Promise<UserInfoEntity> {
    return (
      (await this.userInfoRepository.findOne({
        where: { uid: uid },
        cache: {
          id: CacheIdUtils.getUserInfoEntityCacheId(uid),
          milliseconds: TimeUtils.getTicTimeHMS(24),
        },
      })) ||
      (() => {
        this.removeUserInfoCache(uid);

        throw new NotFoundException(`User does not exist! - [${uid}]`);
      })()
    );
  }

  async updateUserInfoEntity(userInfoEntity: UserInfoEntity): Promise<void> {
    this.removeUserInfoCache(userInfoEntity.uid);

    await this.userInfoRepository.update(
      { uid: userInfoEntity.uid },
      userInfoEntity,
    );
  }

  async deleteUserInfoByUid(uid: string): Promise<void> {
    this.removeUserInfoCache(uid);

    await this.userInfoRepository.delete({ uid: uid });
  }

  private removeUserInfoCache(uid: string): void {
    this.dataSource.queryResultCache.remove([
      CacheIdUtils.getUserInfoEntityCacheId(uid),
    ]);
  }
}
