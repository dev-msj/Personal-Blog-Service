import { Body, Controller, Post } from '@nestjs/common';
import { UserAuthRequestDto } from '../dto/user-auth-request.dto';
import { UserAuthService } from './../service/user-auth.service';

@Controller('users/auth')
export class UserAuthController {
  constructor(private readonly userAuthService: UserAuthService) {}

  @Post('join')
  async join(@Body() userAuthRequestDto: UserAuthRequestDto) {
    return await this.userAuthService.createNewUser(userAuthRequestDto);
  }
}
