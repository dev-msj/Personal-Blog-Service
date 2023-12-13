export class PostLikeDto {
  readonly encryptedPostId: string;
  readonly uid: string;

  constructor(encryptedPostId: string, uid: string) {
    this.encryptedPostId = encryptedPostId;
    this.uid = uid;
  }
}
