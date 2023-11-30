import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserInfoEntity } from '../entities/user-info.entity';
import { Repository } from 'typeorm';
import { UserInfoDao } from '../dao/user-info.dao';
import { TimeUtils } from 'src/utils/time.utills';
import { CacheIdUtils } from 'src/utils/cache-id.utils';

@Injectable()
export class UserInfoRepository {
  constructor(
    @InjectRepository(UserInfoEntity)
    private readonly userInfoRepository: Repository<UserInfoEntity>,
  ) {}

  async findUserInfoDao(uid: string): Promise<UserInfoDao> {
    return UserInfoDao.fromUserInfoEntity(
      (await this.userInfoRepository.findOne({
        where: { uid: uid },
        cache: {
          id: CacheIdUtils.getUserInfoEntityCacheId(uid),
          milliseconds: TimeUtils.getTicTimeHMS(24),
        },
      })) ||
        (() => {
          throw new NotFoundException(`User('${uid}') does not exist!`);
        })(),
    );
  }
}
