import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { UserAuthRequestDto } from '../dto/user-auth-request.dto';
import { UserAuthService } from './../service/user-auth.service';
import { JwtDto } from '../dto/jwt.dto';
import { Public } from '../../decorator/public.decorator';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotAcceptableResponse,
  ApiNotFoundResponse,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@Public()
@Controller('users/auth')
@ApiTags('users/auth')
export class UserAuthController {
  constructor(private readonly userAuthService: UserAuthService) {}

  @Post('join')
  @ApiResponse({
    status: 201,
    description: 'Response JWT(Access Token & Refresh Token)',
  })
  @ApiInternalServerErrorResponse({
    description: 'User already exists. - [uid]',
  })
  @ApiBadRequestResponse({ description: 'Request body error' })
  async join(
    @Body(ValidationPipe) userAuthRequestDto: UserAuthRequestDto,
  ): Promise<JwtDto> {
    return await this.userAuthService.createNewUser(userAuthRequestDto);
  }

  @Post('login')
  @ApiResponse({
    status: 201,
    description: 'Response JWT(Access Token & Refresh Token)',
  })
  @ApiNotFoundResponse({ description: 'User does not exist. - [uid]' })
  @ApiUnauthorizedResponse({ description: 'Password does not match.' })
  @ApiBadRequestResponse({ description: 'Request body error' })
  async login(
    @Body(ValidationPipe) userAuthRequestDto: UserAuthRequestDto,
  ): Promise<JwtDto> {
    return await this.userAuthService.login(userAuthRequestDto);
  }

  @Post('oauth')
  @ApiResponse({
    status: 201,
    description: 'Response JWT(Access Token & Refresh Token)',
  })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
  @ApiBadRequestResponse({ description: 'Request body error' })
  async googleOauthLogin(
    @Body('credentialToken') credentialToken: string,
  ): Promise<JwtDto> {
    return await this.userAuthService.googleOauthLogin(credentialToken);
  }
}
