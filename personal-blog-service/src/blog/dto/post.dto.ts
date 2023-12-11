import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsNumber, IsString } from 'class-validator';
import { CryptoUtils } from '../../utils/crypto.utils';

export class PostDto {
  @ApiProperty({ example: CryptoUtils.encryptPrimaryKey('1', 'example') })
  @IsString()
  readonly postId: string;

  @ApiProperty({ example: 'example1@email.com' })
  @IsString()
  readonly postUid: string;

  @ApiProperty({ example: 'Hello World!' })
  @IsString()
  readonly title: string;

  @ApiProperty({ example: new Date() })
  @IsDate()
  readonly writeDatetime: Date;

  @ApiProperty({ example: 'Example Contents.' })
  @IsString()
  readonly contents: string;

  @ApiProperty({ example: 11 })
  @IsNumber()
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
