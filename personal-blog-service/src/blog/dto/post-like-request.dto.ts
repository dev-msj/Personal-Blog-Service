import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class PostLikeRequestDto {
  @ApiProperty({
    description: '암호화된 Post Id',
    example: 'U2FsdGVkX19IAexd2B4rK0T64%2F8L15kuzw1w78zX4sI%3D',
  })
  @IsString()
  @IsNotEmpty()
  readonly encryptedPostId: string;
}
