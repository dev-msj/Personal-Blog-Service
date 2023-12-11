import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class OauthRequestDto {
  @ApiProperty({
    description: 'Google Oauth 완료 후 발급 받은 Id Token',
  })
  @IsString()
  @IsNotEmpty()
  readonly credentialToken: string;
}
