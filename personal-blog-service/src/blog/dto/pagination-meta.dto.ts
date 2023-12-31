import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({
    description: '총 페이지 수',
    example: 3,
  })
  readonly total: number;

  @ApiProperty({
    description: '현재 페이지 번호',
    example: 1,
  })
  readonly currentPage: number;

  @ApiProperty({
    description: '마지막 페이지 번호',
    example: 3,
  })
  readonly lastPage: number;

  @ApiProperty({
    description: '이전 페이지 존재 여부',
    example: false,
  })
  readonly hasPreviousPage: boolean;

  @ApiProperty({
    description: '다음 페이지 존재 여부',
    example: true,
  })
  readonly hasNextPage: boolean;

  constructor(total: number, currentPage: number, lastPage: number) {
    this.total = total;
    this.currentPage = currentPage;
    this.lastPage = lastPage;
    this.hasPreviousPage = currentPage > 1;
    this.hasNextPage = currentPage < lastPage;
  }
}
