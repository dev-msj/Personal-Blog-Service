import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 3 })
  readonly total: number;

  @ApiProperty({ example: 1 })
  readonly currentPage: number;

  @ApiProperty({ example: 3 })
  readonly lastPage: number;

  @ApiProperty({ example: false })
  readonly hasPreviousPage: boolean;

  @ApiProperty({ example: true })
  readonly hasNextPage: boolean;

  constructor(total: number, currentPage: number, lastPage: number) {
    this.total = total;
    this.currentPage = currentPage;
    this.lastPage = lastPage;
    this.hasPreviousPage = currentPage > 1;
    this.hasNextPage = currentPage < lastPage;
  }
}
