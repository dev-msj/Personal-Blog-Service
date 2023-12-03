import { IsNumber, IsString } from 'class-validator';

export class PostLikeDto {
  @IsNumber()
  readonly postId: number;

  @IsString()
  readonly uid: string;

  constructor(postId: number, uid: string) {
    this.postId = postId;
    this.uid = uid;
  }
}
