import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class UserAuthRequestDto {
  @ApiProperty({
    description: 'Email 형식의 string',
    example: 'example@email.com',
  })
  @IsEmail()
  @IsNotEmpty()
  readonly uid: string;

  @ApiProperty({
    example: 'example password',
  })
  @IsString()
  @IsNotEmpty()
  readonly password: string;

  constructor(uid: string, password: string) {
    this.uid = uid;
    this.password = password;
  }
}
