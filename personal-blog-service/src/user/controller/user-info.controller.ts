import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { UserInfoService } from '../service/user-info.service';
import { UserInfoRequestDto } from '../dto/user-info-request.dto';
import { AuthenticatedUserValidation } from '../../decorator/authenticated-user-validation.decorator';
import { UserInfoDto } from '../dto/user-info.dto';

@Controller('users/info')
export class UserInfoController {
  constructor(private readonly userInfoService: UserInfoService) {}

  @Post()
  async createUserInfo(
    @AuthenticatedUserValidation() authUid: string,
    @Body(ValidationPipe) userInfoRequestDto: UserInfoRequestDto,
  ): Promise<void> {
    this.userInfoService.createUserInfo(
      new UserInfoDto(
        authUid,
        userInfoRequestDto.nickname,
        userInfoRequestDto.introduce,
      ),
    );
  }

  @Get()
  async getUserInfo(
    @AuthenticatedUserValidation() authUid: string,
  ): Promise<void> {
    this.userInfoService.getUserInfoByUid(authUid);
  }

  @Patch()
  async updateUserInfo(
    @AuthenticatedUserValidation() authUid: string,
    @Body(ValidationPipe) userInfoRequestDto: UserInfoRequestDto,
  ): Promise<void> {
    this.userInfoService.createUserInfo(
      new UserInfoDto(
        authUid,
        userInfoRequestDto.nickname,
        userInfoRequestDto.introduce,
      ),
    );
  }

  @Delete()
  async deleteUserInfo(
    @AuthenticatedUserValidation() authUid: string,
  ): Promise<void> {
    this.userInfoService.deleteUserInfoByUid(authUid);
  }
}
