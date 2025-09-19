import { ApiProperty } from '@nestjs/swagger';

export class JwtDto {
  @ApiProperty({
    description: 'Access Token',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhY2Nlc3NUb2tlbiJ9.BuXw-Oc1gM-NNF9-xGs1koroCqJnd_rl0e-7pyDMDJI',
  })
  readonly accessToken: string;

  @ApiProperty({
    description: 'Refresh Token',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJyZWZyZXNoVG9rZW4ifQ.cZymiL0u4IzKC8w66RVrxFGbRHdQho6p6BSVRO7YkZ8',
  })
  readonly refreshToken: string;

  constructor(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }
}
