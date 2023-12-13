import { ApiProperty } from '@nestjs/swagger';

export class UserInfoDto {
  @ApiProperty({
    description: 'Email 형식의 User ID',
    example: 'example@email.com',
  })
  readonly uid: string;

  @ApiProperty({
    description: '중복되지 않는 닉네임',
    example: 'exampleNickname',
  })
  readonly nickname: string;

  @ApiProperty({
    description: '간단한 자기 소개',
    example: 'Hello World! This is example.',
  })
  readonly introduce: string;

  constructor(uid: string, nickname: string, introduce: string) {
    this.uid = uid;
    this.nickname = nickname;
    this.introduce = introduce;
  }
}
