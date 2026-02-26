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

    it('currentPage가 lastPage를 초과할 때 currentPage를 lastPage로 보정', () => {
      // Given: total 45, TAKE 20 → lastPage 3
      const data = ['item1', 'item2'];

      // When: page 999 요청
      const result = PaginationUtils.toPaginationDto(data, 45, 999);

      // Then: currentPage가 lastPage(3)로 보정
      expect(result.paginationMeta.currentPage).toBe(3);
      expect(result.paginationMeta.lastPage).toBe(3);
      expect(result.paginationMeta.hasPreviousPage).toBe(true);
      expect(result.paginationMeta.hasNextPage).toBe(false);
    });

    it('currentPage가 lastPage와 같을 때 보정하지 않음', () => {
      // Given: total 45, TAKE 20 → lastPage 3
      const data = ['item1'];

      // When: 정확히 lastPage 요청
      const result = PaginationUtils.toPaginationDto(data, 45, 3);

      // Then: currentPage 그대로 유지
      expect(result.paginationMeta.currentPage).toBe(3);
      expect(result.paginationMeta.lastPage).toBe(3);
    });
  });
});
