import { Body, Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import {
  ApiOperation,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiOkResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiBearerAuth,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { UserInfoService } from '../service/user-info.service';
import { UserInfoRequestDto } from '../dto/user-info-request.dto';
import { AuthenticatedUserValidation } from '../../decorator/authenticated-user-validation.decorator';
import { UserInfoDto } from '../dto/user-info.dto';
import { SuccessResponse } from '../../response/success-response.dto';
import { successResponseOpions } from '../../response/swagger/success-response-options';
import { UserInfoGetRequestDto } from '../dto/user-info-get-request.dto';

@Controller('users/info')
@ApiTags('users/info')
@ApiBearerAuth('accessToken')
@ApiCookieAuth('refreshToken')
export class UserInfoController {
  constructor(private readonly userInfoService: UserInfoService) {}

  @Post()
  @ApiOperation({ description: '유저 정보 생성 API' })
  @ApiCreatedResponse(successResponseOpions)
  @ApiConflictResponse({ description: 'UserInfo already exist. - [uid]' })
  @ApiBadRequestResponse({ description: 'Request body error' })
  async createUserInfo(
    @AuthenticatedUserValidation() authUid: string,
    @Body() userInfoRequestDto: UserInfoRequestDto,
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
  @ApiOkResponse({
    description: 'Response UserInfoDto',
    type: UserInfoDto,
  })
  @ApiNotFoundResponse({ description: 'User does not exist! - [uid]' })
  async getUserInfo(
    @Body() userInfoGetRequest: UserInfoGetRequestDto,
  ): Promise<UserInfoDto> {
    return await this.userInfoService.getUserInfoByUid(userInfoGetRequest.uid);
  }

  @Patch()
  @ApiOperation({ description: '유저 정보 수정 API' })
  @ApiOkResponse(successResponseOpions)
  @ApiConflictResponse({
    description: 'UserInfo does not exist. - [uid]',
  })
  @ApiBadRequestResponse({ description: 'Request body error' })
  async updateUserInfo(
    @AuthenticatedUserValidation() authUid: string,
    @Body() userInfoRequestDto: UserInfoRequestDto,
  ): Promise<SuccessResponse> {
    await this.userInfoService.updateUserInfo(
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
  @ApiOkResponse(successResponseOpions)
  @ApiConflictResponse({
    description: 'UserInfo does not exist. - [uid]',
  })
  async deleteUserInfo(
    @AuthenticatedUserValidation() authUid: string,
  ): Promise<SuccessResponse> {
    await this.userInfoService.deleteUserInfoByUid(authUid);

    return new SuccessResponse();
  }
}
