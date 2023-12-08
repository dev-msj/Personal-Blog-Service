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
import { SuccessResponse } from '../../response/success-response.dto';

@Controller('users/info')
export class UserInfoController {
  constructor(private readonly userInfoService: UserInfoService) {}

  @Post()
  async createUserInfo(
    @AuthenticatedUserValidation() authUid: string,
    @Body(ValidationPipe) userInfoRequestDto: UserInfoRequestDto,
  ): Promise<SuccessResponse> {
    await this.userInfoService.createUserInfo(
      new UserInfoDto(
        authUid,
        userInfoRequestDto.nickname,
        userInfoRequestDto.introduce,
      ),
    );

    return new SuccessResponse();
  }

  @Get()
  async getUserInfo(
    @AuthenticatedUserValidation() authUid: string,
  ): Promise<UserInfoDto> {
    return await this.userInfoService.getUserInfoByUid(authUid);
  }

  @Patch()
  async updateUserInfo(
    @AuthenticatedUserValidation() authUid: string,
    @Body(ValidationPipe) userInfoRequestDto: UserInfoRequestDto,
  ): Promise<SuccessResponse> {
    await this.userInfoService.createUserInfo(
      new UserInfoDto(
        authUid,
        userInfoRequestDto.nickname,
        userInfoRequestDto.introduce,
      ),
    );

    return new SuccessResponse();
  }

  @Delete()
  async deleteUserInfo(
    @AuthenticatedUserValidation() authUid: string,
  ): Promise<SuccessResponse> {
    await this.userInfoService.deleteUserInfoByUid(authUid);

    return new SuccessResponse();
  }
}
