import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { UserAuthRequestDto } from '../dto/user-auth-request.dto';
import { UserAuthService } from './../service/user-auth.service';
import { JwtDto } from '../dto/jwt.dto';
import { Public } from '../../decorator/public.decorator';

@Public()
@Controller('users/auth')
export class UserAuthController {
  constructor(private readonly userAuthService: UserAuthService) {}

  @Post('join')
  async join(
    @Body(ValidationPipe) userAuthRequestDto: UserAuthRequestDto,
  ): Promise<JwtDto> {
    return await this.userAuthService.createNewUser(userAuthRequestDto);
  }

  @Post('login')
  async login(
    @Body(ValidationPipe) userAuthRequestDto: UserAuthRequestDto,
  ): Promise<JwtDto> {
    return await this.userAuthService.login(userAuthRequestDto);
  }

  @Post('oauth')
  async googleOauthLogin(
    @Body('credentialToken') credentialToken: string,
  ): Promise<JwtDto> {
    return await this.userAuthService.googleOauthLogin(credentialToken);
  }
}
