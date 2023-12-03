import { IsDate, IsNumber, IsString } from 'class-validator';

export class PostDto {
  @IsString()
  readonly postId: string;

  @IsString()
  readonly postUid: string;

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
    postId: string,
    postUid: string,
    title: string,
    writeDateTime: Date,
    contents: string,
    hits: number,
    postLikeUidList: string[],
  ) {
    this.postId = postId;
    this.postUid = postUid;
    this.title = title;
    this.writeDatetime = writeDateTime;
    this.contents = contents;
    this.hits = hits;
    this.postLikeUidList = postLikeUidList;
  }
}
