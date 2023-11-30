import { PaginationDto } from '../blog/dto/pagination.dto';
import { PaginationMetaDto } from '../blog/dto/pagination-meta.dto';

export class PaginationUtils {
  static readonly TAKE: number = 20;

  static toPaginationDto<T>(data: T[], total: number, currentPage: number) {
    const paginationMetaDto = new PaginationMetaDto(
      total,
      currentPage,
      this.getLastPage(total),
    );

    return new PaginationDto(data, paginationMetaDto);
  }

  private static getLastPage(total: number) {
    return Math.ceil(total / this.TAKE);
  }
}
