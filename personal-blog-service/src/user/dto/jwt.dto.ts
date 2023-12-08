import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class JwtDto {
  @ApiProperty()
  @IsString()
  readonly accessToken: string;

  @ApiProperty()
  @IsString()
  readonly refreshToken: string;

  constructor(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }
}
