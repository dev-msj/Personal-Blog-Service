import { InvalidPageException } from '../exception/invalid-page.exception';
import { PaginationUtils } from './pagination.utils';

describe('PaginationUtils', () => {
  describe('getSkip', () => {
    it('page 1일 때 skip 0 반환', () => {
      // When
      const result = PaginationUtils.getSkip(1);

      // Then
      expect(result).toBe(0);
    });

    it('page 2일 때 skip TAKE 반환', () => {
      // When
      const result = PaginationUtils.getSkip(2);

      // Then
      expect(result).toBe(PaginationUtils.TAKE);
    });

    it('page가 1보다 작을 때 InvalidPageException 발생', () => {
      // When & Then
      expect(() => PaginationUtils.getSkip(0)).toThrow(InvalidPageException);
    });
  });

  describe('toPaginationDto', () => {
    it('total 0일 때 lastPage 1 반환', () => {
      // When
      const result = PaginationUtils.toPaginationDto([], 0, 1);

      // Then
      expect(result.paginationMeta.lastPage).toBe(1);
    });

    it('total 45일 때 lastPage 3 반환', () => {
      // When
      const result = PaginationUtils.toPaginationDto([], 45, 1);

      // Then
      expect(result.paginationMeta.lastPage).toBe(3);
    });

    it('currentPage가 1보다 작을 때 InvalidPageException 발생', () => {
      // When & Then
      expect(() => PaginationUtils.toPaginationDto([], 10, 0)).toThrow(
        InvalidPageException,
      );
    });
  });
});
