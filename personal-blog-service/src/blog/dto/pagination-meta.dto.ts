import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class PaginationMetaDto {
  @ApiProperty({ example: 3 })
  @IsNumber()
  readonly total: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  readonly currentPage: number;

  @ApiProperty({ example: 3 })
  @IsNumber()
  readonly lastPage: number;

  @ApiProperty({ example: false })
  @IsNumber()
  readonly hasPreviousPage: boolean;

  @ApiProperty({ example: true })
  @IsNumber()
  readonly hasNextPage: boolean;

  constructor(total: number, currentPage: number, lastPage: number) {
    this.total = total;
    this.currentPage = currentPage;
    this.lastPage = lastPage;
    this.hasPreviousPage = currentPage > 1;
    this.hasNextPage = currentPage < lastPage;
  }
}
