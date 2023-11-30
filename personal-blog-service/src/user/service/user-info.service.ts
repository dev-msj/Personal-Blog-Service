import { Injectable } from '@nestjs/common';
import { UserInfoDto } from '../dto/user-info.dto';
import { UserInfoRepository } from '../repository/user-info.repository';

@Injectable()
export class UserInfoService {
  constructor(private readonly userInfoRepository: UserInfoRepository) {}

  async getUserInfoDto(uid: string): Promise<UserInfoDto> {
    return (await this.userInfoRepository.findUserInfoDao(uid)).toUserInfoDto();
  }
}
