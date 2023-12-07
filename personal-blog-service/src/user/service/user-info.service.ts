import { Injectable } from '@nestjs/common';
import { UserInfoDto } from '../dto/user-info.dto';
import { UserInfoRepository } from '../repository/user-info.repository';
import { UserInfoDao } from '../dao/user-info.dao';

@Injectable()
export class UserInfoService {
  constructor(private readonly userInfoRepository: UserInfoRepository) {}

  async getUserInfoDto(uid: string): Promise<UserInfoDto> {
    return UserInfoDao.from(
      await this.userInfoRepository.findUserInfoEntity(uid),
    ).toUserInfoDto();
  }
}
