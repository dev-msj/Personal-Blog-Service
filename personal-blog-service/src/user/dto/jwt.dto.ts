import { IsString } from 'class-validator';

export class JwtDto {
  @IsString()
  readonly accessToken: string;

  @IsString()
  readonly refreshToken: string;

  constructor(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }
}
