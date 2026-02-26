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
    // 방어 코드: 서비스 레이어에서 이미 lastPage로 재조회하지만,
    // toPaginationDto가 직접 호출될 경우를 대비한 안전망
    const adjustedPage = Math.min(currentPage, lastPage);

    const paginationMetaDto = new PaginationMetaDto(
      total,
      adjustedPage,
      lastPage,
    );

    return new PaginationDto(data, paginationMetaDto);
  }

  static getLastPage(total: number): number {
    return Math.max(1, Math.ceil(total / this.TAKE));
  }
}
