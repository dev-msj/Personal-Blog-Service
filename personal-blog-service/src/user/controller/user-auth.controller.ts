import { Body, Controller, Post } from '@nestjs/common';
import { UserAuthRequestDto } from '../dto/user-auth-request.dto';
import { UserAuthService } from './../service/user-auth.service';
import { JwtDto } from '../dto/jwt.dto';

@Controller('users/auth')
export class UserAuthController {
  constructor(private readonly userAuthService: UserAuthService) {}

  @Post('join')
  async join(@Body() userAuthRequestDto: UserAuthRequestDto): Promise<JwtDto> {
    return await this.userAuthService.createNewUser(userAuthRequestDto);
  }

  @Post('login')
  async login(@Body() userAuthRequestDto: UserAuthRequestDto): Promise<JwtDto> {
    return await this.userAuthService.login(userAuthRequestDto);
  }
}
