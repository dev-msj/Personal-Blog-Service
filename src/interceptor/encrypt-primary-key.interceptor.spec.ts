import { EncryptPrimaryKeyInterceptor } from './encrypt-primary-key.interceptor';
import { CryptoUtils } from '../utils/crypto.utils';
import { EncryptField } from '../decorator/encrypt-field.decorator';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

class TestDto {
  @EncryptField()
  id: number;

  @EncryptField()
  uid: string;

  name: string;

  constructor(id: number, uid: string, name: string) {
    this.id = id;
    this.uid = uid;
    this.name = name;
  }
}

class TestPaginationDto {
  data: TestDto[];
  meta: { total: number };

  constructor(data: TestDto[], total: number) {
    this.data = data;
    this.meta = { total };
  }
}

describe('EncryptPrimaryKeyInterceptor', () => {
  const pkSecretKey = 'test-secret-key!';
  let interceptor: EncryptPrimaryKeyInterceptor;
  const mockContext = {} as ExecutionContext;

  beforeAll(() => {
    interceptor = new EncryptPrimaryKeyInterceptor({ pkSecretKey } as any);
  });

  it('응답 객체의 @EncryptField() 필드를 암호화한다', (done) => {
    // Given
    const dto = new TestDto(123, 'test-uid', 'name');
    const next: CallHandler = { handle: () => of(dto) };

    // When
    interceptor.intercept(mockContext, next).subscribe((result) => {
      // Then
      const decryptedId = CryptoUtils.decryptPrimaryKey(result.id, pkSecretKey);
      const decryptedUid = CryptoUtils.decryptPrimaryKey(
        result.uid,
        pkSecretKey,
      );
      expect(decryptedId).toBe('123');
      expect(decryptedUid).toBe('test-uid');
      expect(result.name).toBe('name');
      done();
    });
  });

  it('PaginationDto의 data 배열 내 항목들을 암호화한다', (done) => {
    // Given
    const items = [
      new TestDto(1, 'uid-1', 'name1'),
      new TestDto(2, 'uid-2', 'name2'),
    ];
    const pagination = new TestPaginationDto(items, 2);
    const next: CallHandler = { handle: () => of(pagination) };

    // When
    interceptor.intercept(mockContext, next).subscribe((result) => {
      // Then
      expect(
        CryptoUtils.decryptPrimaryKey(result.data[0].id, pkSecretKey),
      ).toBe('1');
      expect(
        CryptoUtils.decryptPrimaryKey(result.data[0].uid, pkSecretKey),
      ).toBe('uid-1');
      expect(result.data[0].name).toBe('name1');

      expect(
        CryptoUtils.decryptPrimaryKey(result.data[1].id, pkSecretKey),
      ).toBe('2');
      expect(result.meta.total).toBe(2);
      done();
    });
  });

  it('@EncryptField()가 없는 객체는 변환하지 않는다', (done) => {
    // Given
    const plainObj = { code: 200, message: 'Success!' };
    const next: CallHandler = { handle: () => of(plainObj) };

    // When
    interceptor.intercept(mockContext, next).subscribe((result) => {
      // Then
      expect(result).toEqual({ code: 200, message: 'Success!' });
      done();
    });
  });

  it('null 응답은 그대로 반환한다', (done) => {
    // Given
    const next: CallHandler = { handle: () => of(null) };

    // When
    interceptor.intercept(mockContext, next).subscribe((result) => {
      // Then
      expect(result).toBeNull();
      done();
    });
  });

  it('원본 객체를 변이시키지 않고 복사본을 반환한다', (done) => {
    // Given
    const dto = new TestDto(123, 'test-uid', 'name');
    const next: CallHandler = { handle: () => of(dto) };

    // When
    interceptor.intercept(mockContext, next).subscribe((result) => {
      // Then: 원본 유지
      expect(dto.id).toBe(123);
      expect(dto.uid).toBe('test-uid');
      // 반환값은 암호화된 복사본
      expect(result).not.toBe(dto);
      expect(result.id).not.toBe(123);
      done();
    });
  });

  it('PaginationDto 원본 배열을 변이시키지 않는다', (done) => {
    // Given
    const items = [new TestDto(1, 'uid-1', 'name1')];
    const pagination = new TestPaginationDto(items, 1);
    const next: CallHandler = { handle: () => of(pagination) };

    // When
    interceptor.intercept(mockContext, next).subscribe((result) => {
      // Then: 원본 유지
      expect(items[0].id).toBe(1);
      expect(items[0].uid).toBe('uid-1');
      // 반환값의 data는 새 배열
      expect(result.data).not.toBe(items);
      done();
    });
  });
});
