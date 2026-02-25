import { EncryptField } from '../../decorator/encrypt-field.decorator';

export class PostDto {
  @EncryptField()
  readonly postId: number;

  @EncryptField()
  readonly postUid: string;

  readonly title: string;
  readonly writeDatetime: Date;
  readonly contents: string;
  readonly hits: number;
  readonly postLikeNicknameList: string[];

  constructor(
    postId: number,
    postUid: string,
    title: string,
    writeDateTime: Date,
    contents: string,
    hits: number,
    postLikeNicknameList: string[],
  ) {
    this.postId = postId;
    this.postUid = postUid;
    this.title = title;
    this.writeDatetime = writeDateTime;
    this.contents = contents;
    this.hits = hits;
    this.postLikeNicknameList = postLikeNicknameList;
  }
}
