import { IsArray } from 'class-validator';
import { PaginationMetaDto } from './pagination-meta.dto';
import { ApiProperty } from '@nestjs/swagger';

export class PaginationDto<T> {
  @IsArray()
  readonly data: T[];

  @ApiProperty({
    description: '페이징 정보',
  })
  readonly paginationMeta: PaginationMetaDto;

  constructor(data: T[], paginationMetaDto: PaginationMetaDto) {
    this.data = data;
    this.paginationMeta = paginationMetaDto;
  }
}
