import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
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
  ) {
    this.userInfoService.createUserInfo(
      new UserInfoDto(
        authUid,
        userInfoRequestDto.nickname,
        userInfoRequestDto.introduce,
      ),
    );
  }
}
