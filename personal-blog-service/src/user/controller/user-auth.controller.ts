import { Body, Controller, Post } from '@nestjs/common';
import { UserJoinRequestDto } from '../dto/user-join-request.dto';
import { UserAuthService } from './../service/user-auth.service';

@Controller('users/auth')
export class UserAuthController {
  constructor(private readonly userAuthService: UserAuthService) {}

  @Post('join')
  async join(@Body() userJoinRequestDto: UserJoinRequestDto) {
    return await this.userAuthService.createNewUser(userJoinRequestDto);
  }
}
