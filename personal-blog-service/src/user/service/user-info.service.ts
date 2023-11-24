import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserInfoEntity } from '../entities/user-info.entity';
import { Repository } from 'typeorm';
import { UserInfoDao } from '../dao/user-info.dao';
import { UserInfoDto } from '../dto/user-info.dto';

@Injectable()
export class UserInfoService {
  constructor(
    @InjectRepository(UserInfoEntity)
    private readonly userInfoRepository: Repository<UserInfoEntity>,
  ) {}

  async getUserInfoDto(uid: string): Promise<UserInfoDto> {
    return UserInfoDao.fromUserInfoEntity(
      await this.userInfoRepository.findOne({
        where: { uid: uid },
      }),
    ).toUserInfoDto();
  }
}
