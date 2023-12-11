import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UserInfoDto {
  @ApiProperty({
    description: 'Email 형식의 User ID',
    example: 'example@email.com',
  })
  @IsString()
  @IsNotEmpty()
  readonly uid: string;

  @ApiProperty({
    description: '중복되지 않는 닉네임',
    example: 'exampleNickname',
  })
  @IsString()
  @IsNotEmpty()
  readonly nickname: string;

  @ApiProperty({
    description: '간단한 자기 소개',
    example: 'Hello World! This is example.',
  })
  @IsString()
  @IsNotEmpty()
  readonly introduce: string;

  constructor(uid: string, nickname: string, introduce: string) {
    this.uid = uid;
    this.nickname = nickname;
    this.introduce = introduce;
  }
}
