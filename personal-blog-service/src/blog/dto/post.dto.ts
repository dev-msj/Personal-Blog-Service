import { ApiProperty } from '@nestjs/swagger';

export class PostDto {
  @ApiProperty({
    description: 'Server에서 암호화하여 보내준 postId 값',
    example: 'U2FsdGVkX1%2BZUpmujgDXgSs%2BPqpQUdWxjlgu%2FESLUlQ%3D',
  })
  readonly postId: string;

  @ApiProperty({
    description: 'Server에서 암호화하여 보내준 postUid 값',
    example: 'U2FsdGVkX18LAR9DqL2ix0kCNjn9zvceXoSyrKHkl4QRf8hgyRIWObotjECRakTV',
  })
  readonly postUid: string;

  @ApiProperty({
    description: '글 제목',
    example: 'Hello World!',
  })
  readonly title: string;

  @ApiProperty({
    description: '글을 작성한 날짜와 시각',
    example: '2023-12-31T12:26:57.991Z',
  })
  readonly writeDatetime: Date;

  @ApiProperty({
    description: '작성한 글',
    example: 'Example Contents.',
  })
  readonly contents: string;

  @ApiProperty({
    description: '글 조회수',
    example: 11,
  })
  readonly hits: number;

  @ApiProperty({
    description: '글에 좋아요를 누른 유저들의 닉네임 목록',
    examples: ['nickname1', 'nickname2', 'nickname3'],
  })
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
