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
import {
  ApiOperation,
  ApiCreatedResponse,
  ApiNotAcceptableResponse,
  ApiResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';

@Controller('users/info')
@ApiTags('users/info')
export class UserInfoController {
  constructor(private readonly userInfoService: UserInfoService) {}

  @Post()
  @ApiOperation({ description: '유저 정보 생성 API' })
  @ApiCreatedResponse({ description: 'success', type: SuccessResponse })
  @ApiNotAcceptableResponse({ description: 'UserInfo already exist. - [uid]' })
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
  @ApiOperation({ description: '유저 정보 요청 API' })
  @ApiResponse({
    description: 'Response UserInfoDto',
    type: UserInfoDto,
  })
  @ApiNotFoundResponse({ description: 'User does not exist! - [uid]' })
  async getUserInfo(
    @AuthenticatedUserValidation() authUid: string,
  ): Promise<UserInfoDto> {
    return await this.userInfoService.getUserInfoByUid(authUid);
  }

  @Patch()
  @ApiOperation({ description: '유저 정보 수정 API' })
  @ApiResponse({
    description: 'success',
    type: SuccessResponse,
  })
  @ApiNotFoundResponse({
    description: 'UserInfo does not exist. - [uid]',
  })
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
  @ApiOperation({ description: '유저 정보 삭제 API' })
  @ApiResponse({
    description: 'success',
    type: SuccessResponse,
  })
  @ApiNotFoundResponse({
    description: 'UserInfo does not exist. - [uid]',
  })
  async deleteUserInfo(
    @AuthenticatedUserValidation() authUid: string,
  ): Promise<SuccessResponse> {
    await this.userInfoService.deleteUserInfoByUid(authUid);

    return new SuccessResponse();
  }
}
