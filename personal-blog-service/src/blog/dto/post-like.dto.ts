import { IsNumber, IsString } from 'class-validator';

export class PostLikeDto {
  @IsString()
  readonly postUid: string;

  @IsNumber()
  readonly postId: number;

  @IsString()
  readonly uid: string;

  constructor(postUid: string, postId: number, uid: string) {
    this.postUid = postUid;
    this.postId = postId;
    this.uid = uid;
  }
}
