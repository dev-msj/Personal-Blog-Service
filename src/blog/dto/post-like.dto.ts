export class PostLikeDto {
  readonly postId: number;
  readonly uid: string;

  constructor(postId: number, uid: string) {
    this.postId = postId;
    this.uid = uid;
  }
}
