import { IsString } from 'class-validator';

export class PostLikeDto {
  @IsString()
  readonly encryptedPostId: string;

  @IsString()
  readonly uid: string;

  constructor(encryptedPostId: string, uid: string) {
    this.encryptedPostId = encryptedPostId;
    this.uid = uid;
  }
}
