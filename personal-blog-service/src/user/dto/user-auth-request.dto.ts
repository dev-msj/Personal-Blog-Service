import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UserAuthRequestDto {
  @ApiProperty({
    description: "User's email",
    example: 'example@email.com',
  })
  @IsString()
  readonly uid: string;

  @ApiProperty({
    description: "User's password",
    example: 'example password',
  })
  @IsString()
  readonly password: string;

  constructor(uid: string, password: string) {
    this.uid = uid;
    this.password = password;
  }
}
