import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { UserAuthRequestDto } from '../dto/user-auth-request.dto';
import { UserAuthService } from './../service/user-auth.service';
import { JwtDto } from '../dto/jwt.dto';
import { Public } from '../../decorator/public.decorator';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OauthRequestDto } from '../dto/oauth-request.dto';

@Public()
@Controller('users/auth')
@ApiTags('users/auth')
export class UserAuthController {
  constructor(private readonly userAuthService: UserAuthService) {}

  @Post('join')
  @ApiOperation({ description: '회원가입 요청 API' })
  @ApiResponse({
    status: 201,
    description: 'Response JWT(Access Token & Refresh Token)',
    type: JwtDto,
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
  @ApiOperation({ description: '로그인 요청 API' })
  @ApiCreatedResponse({
    description: 'Response JWT(Access Token & Refresh Token)',
    type: JwtDto,
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
  @ApiOperation({
    description:
      'Google Oauth으로 발급받은 Id Token으로 로그인 요청 API. 가입된 정보가 없을 경우 자동으로 회원가입한다.',
  })
  @ApiResponse({
    status: 201,
    description: 'Response JWT(Access Token & Refresh Token)',
    type: JwtDto,
  })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
  @ApiBadRequestResponse({ description: 'Request body error' })
  async googleOauthLogin(
    @Body(ValidationPipe) oauthRequestDto: OauthRequestDto,
  ): Promise<JwtDto> {
    return await this.userAuthService.googleOauthLogin(oauthRequestDto);
  }
}
