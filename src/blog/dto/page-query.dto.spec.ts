import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PageQueryDto } from './page-query.dto';

describe('PageQueryDto', () => {
  it('page 미제공 시 기본값 1 적용', async () => {
    // Given
    const dto = plainToInstance(PageQueryDto, {});

    // When
    const errors = await validate(dto);

    // Then
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(1);
  });

  it('page 제공 시 해당 값 사용', async () => {
    // Given
    const dto = plainToInstance(PageQueryDto, { page: 3 });

    // When
    const errors = await validate(dto);

    // Then
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(3);
  });

  it('page가 문자열로 전달되면 숫자로 변환', async () => {
    // Given: query param은 문자열로 도착
    const dto = plainToInstance(PageQueryDto, { page: '3' });

    // When
    const errors = await validate(dto);

    // Then
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(3);
  });

  it('page가 1 미만일 때 유효성 검증 실패', async () => {
    // Given
    const dto = plainToInstance(PageQueryDto, { page: 0 });

    // When
    const errors = await validate(dto);

    // Then
    expect(errors.length).toBeGreaterThan(0);
  });
});
