import { Inject, Injectable } from '@nestjs/common';
import { UserInfoDto } from '../dto/user-info.dto';
import { UserInfoRepository } from '../repository/user-info.repository';
import { UserInfoDao } from '../dao/user-info.dao';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ErrorCode } from '../../constant/error-code.enum';
import { BaseException } from '../../exception/base.exception';

@Injectable()
export class UserInfoService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
    private readonly userInfoRepository: UserInfoRepository,
  ) {}

  async createUserInfo(userInfoDto: UserInfoDto): Promise<void> {
    const isExist = await this.userInfoRepository.isExist(userInfoDto.uid);
    if (isExist) {
      throw new BaseException(
        ErrorCode.USER_INFO_ALREADY_EXISTS,
        `UserInfo already exist. - [${userInfoDto.uid}]`,
      );
    }

    await this.userInfoRepository.saveUserInfoEntity(
      UserInfoDao.from({ ...userInfoDto }).toUserInfoEntity(),
    );

    this.logger.info(`UserInfo has been created. - [${userInfoDto.uid}]`);
  }

  async getUserInfoByUid(uid: string): Promise<UserInfoDto> {
    return UserInfoDao.from(
      await this.userInfoRepository.findUserInfoEntity(uid),
    ).toUserInfoDto();
  }

  async updateUserInfo(userInfoDto: UserInfoDto): Promise<void> {
    const isExist = await this.userInfoRepository.isExist(userInfoDto.uid);
    if (!isExist) {
      throw new BaseException(
        ErrorCode.USER_INFO_NOT_FOUND,
        `UserInfo does not exist. - [${userInfoDto.uid}]`,
      );
    }

    await this.userInfoRepository.updateUserInfoEntity(
      UserInfoDao.from({ ...userInfoDto }).toUserInfoEntity(),
    );

    this.logger.info(`UserInfo has been updated. - [${userInfoDto.uid}]`);
  }

  async deleteUserInfoByUid(uid: string): Promise<void> {
    const isExist = await this.userInfoRepository.isExist(uid);
    if (!isExist) {
      throw new BaseException(
        ErrorCode.USER_INFO_NOT_FOUND,
        `UserInfo does not exist. - [${uid}]`,
      );
    }

    await this.userInfoRepository.deleteUserInfoByUid(uid);

    this.logger.info(`UserInfo has been deleted. - [${uid}]`);
  }
}
