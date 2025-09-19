import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UserInfoRequestDto {
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

  constructor(nickname: string, introduce: string) {
    this.nickname = nickname;
    this.introduce = introduce;
  }
}
