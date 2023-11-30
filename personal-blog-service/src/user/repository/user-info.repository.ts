import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserInfoEntity } from '../entities/user-info.entity';
import { Repository } from 'typeorm';
import { UserInfoDao } from '../dao/user-info.dao';

@Injectable()
export class UserInfoRepository {
  constructor(
    @InjectRepository(UserInfoEntity)
    private readonly userInfoRepository: Repository<UserInfoEntity>,
  ) {}

  async findUserInfoDao(uid: string): Promise<UserInfoDao> {
    return UserInfoDao.fromUserInfoEntity(
      await this.userInfoRepository.findOne({
        where: { uid: uid },
      }),
    );
  }
}
