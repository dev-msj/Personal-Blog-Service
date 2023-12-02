import { IsNumber, IsString } from 'class-validator';

export class PostLikeRequestDto {
  @IsString()
  readonly postUid: string;

  @IsNumber()
  readonly postId: number;
}
