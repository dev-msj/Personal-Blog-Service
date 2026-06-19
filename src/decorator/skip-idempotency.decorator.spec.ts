import { Reflector } from '@nestjs/core';
import {
  SkipIdempotency,
  SKIP_IDEMPOTENCY_KEY,
} from './skip-idempotency.decorator';

describe('@SkipIdempotency', () => {
  const reflector = new Reflector();

  it('핸들러에 skipIdempotency=true 메타데이터를 설정한다', () => {
    class Sut {
      @SkipIdempotency()
      handler(): void {}
    }

    const value = reflector.get<boolean>(
      SKIP_IDEMPOTENCY_KEY,
      Sut.prototype.handler,
    );

    expect(value).toBe(true);
  });

  it('부착하지 않은 핸들러에는 메타데이터가 없다(undefined)', () => {
    class Sut {
      handler(): void {}
    }

    const value = reflector.get<boolean>(
      SKIP_IDEMPOTENCY_KEY,
      Sut.prototype.handler,
    );

    expect(value).toBeUndefined();
  });

  it('getAllAndOverride([handler, class])로 메서드 우선·클래스 폴백 조회된다', () => {
    @SkipIdempotency()
    class Sut {
      handler(): void {}
    }

    const value = reflector.getAllAndOverride<boolean>(SKIP_IDEMPOTENCY_KEY, [
      Sut.prototype.handler,
      Sut,
    ]);

    expect(value).toBe(true);
  });
});
