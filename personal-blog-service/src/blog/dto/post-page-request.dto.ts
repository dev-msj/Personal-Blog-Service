import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class PostPageRequestDto {
  @ApiProperty({
    description: '암호화된 PostUid',
    example:
      'U2FsdGVkX19znGNgziakgR2tbqcNSvfTdD1aoEBVh%2BCGRryU817NvgX%2BaRJhllhV',
  })
  @IsString()
  @IsNotEmpty()
  readonly encryptedPostUid: string;

  @ApiProperty({
    description: '요청할 페이지 번호',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  readonly page: number;

  constructor(encryptedPostUid: string, page: number) {
    this.encryptedPostUid = encryptedPostUid;
    this.page = page;
  }
}
