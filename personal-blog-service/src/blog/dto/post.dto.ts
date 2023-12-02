import { IsDate, IsNumber, IsString } from 'class-validator';

export class PostDto {
  @IsString()
  readonly postUid: string;

  @IsString()
  readonly postId: string;

  @IsString()
  readonly title: string;

  @IsDate()
  readonly writeDatetime: Date;

  @IsString()
  readonly contents: string;

  @IsNumber()
  readonly hits: number;

  readonly postLikeUidList: string[];

  constructor(
    postUid: string,
    postId: string,
    title: string,
    writeDateTime: Date,
    contents: string,
    hits: number,
    postLikeUidList: string[],
  ) {
    this.postUid = postUid;
    this.postId = postId;
    this.title = title;
    this.writeDatetime = writeDateTime;
    this.contents = contents;
    this.hits = hits;
    this.postLikeUidList = postLikeUidList;
  }
}
