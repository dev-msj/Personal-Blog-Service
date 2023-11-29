import { IsNumber } from 'class-validator';

export class PaginationMetaDto {
  @IsNumber()
  readonly total: number;

  @IsNumber()
  readonly currentPage: number;

  @IsNumber()
  readonly lastPage: number;

  @IsNumber()
  readonly hasPreviousPage: boolean;

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
