import { ApiProperty } from '@nestjs/swagger';
import { CryptoUtils } from '../../utils/crypto.utils';

export class PostDto {
  @ApiProperty({ example: CryptoUtils.encryptPrimaryKey('1', 'example') })
  readonly postId: string;

  @ApiProperty({ example: 'example1@email.com' })
  readonly postUid: string;

  @ApiProperty({ example: 'Hello World!' })
  readonly title: string;

  @ApiProperty({ example: new Date() })
  readonly writeDatetime: Date;

  @ApiProperty({ example: 'Example Contents.' })
  readonly contents: string;

  @ApiProperty({ example: 11 })
  readonly hits: number;

  @ApiProperty({ examples: ['nickname1', 'nickname2', 'nickname3'] })
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
