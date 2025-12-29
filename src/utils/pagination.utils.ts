import { PaginationDto } from '../blog/dto/pagination.dto';
import { PaginationMetaDto } from '../blog/dto/pagination-meta.dto';
import { InvalidPageException } from '../exception/invalid-page.exception';

export class PaginationUtils {
  static readonly TAKE: number = 20;

  static getSkip(page: number): number {
    if (page < 1) {
      throw new InvalidPageException(page);
    }
    return (page - 1) * this.TAKE;
  }

  static toPaginationDto<T>(data: T[], total: number, currentPage: number) {
    if (currentPage < 1) {
      throw new InvalidPageException(currentPage);
    }
    const lastPage = this.getLastPage(total);

    const paginationMetaDto = new PaginationMetaDto(
      total,
      currentPage,
      lastPage,
    );

    return new PaginationDto(data, paginationMetaDto);
  }

  private static getLastPage(total: number): number {
    return Math.max(1, Math.ceil(total / this.TAKE));
  }
}
