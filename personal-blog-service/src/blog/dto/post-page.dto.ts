export class PostPageDto {
  readonly postUid: string;
  readonly page: number;

  constructor(postUid: string, page: number) {
    this.postUid = postUid;
    this.page = page;
  }
}
