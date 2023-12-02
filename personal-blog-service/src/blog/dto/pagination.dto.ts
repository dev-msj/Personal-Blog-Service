import { IsArray } from 'class-validator';
import { PaginationMetaDto } from './pagination-meta.dto';

export class PaginationDto<T> {
  @IsArray()
  readonly data: T[];

  readonly paginationMeta: PaginationMetaDto;

  constructor(data: T[], paginationMetaDto: PaginationMetaDto) {
    this.data = data;
    this.paginationMeta = paginationMetaDto;
  }
}
