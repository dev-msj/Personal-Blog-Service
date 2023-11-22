import { IsNumber, IsString } from 'class-validator';

export class PostLikeDto {
  @IsString()
  readonly postUid: string;

  @IsNumber()
  readonly postId: number;

  @IsString()
  readonly uid: string;
}
