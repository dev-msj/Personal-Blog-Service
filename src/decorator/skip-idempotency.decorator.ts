import { SetMetadata } from '@nestjs/common';

export const SKIP_IDEMPOTENCY_KEY = 'skipIdempotency';

/**
 * IdempotencyKeyInterceptor 우회 표식.
 *
 * login/refresh/oauth 등 인증 자격 검증 흐름은 응답 캐싱이 부적합하므로
 * 핸들러(또는 컨트롤러)에 부착하여 멱등 처리에서 제외한다
 * (flows/idempotency-key-handle.md §미대상).
 *
 * 인터셉터는 getAllAndOverride([handler, class])로 조회하여
 * 메서드 우선·클래스 폴백 적용한다.
 */
export const SkipIdempotency = () => SetMetadata(SKIP_IDEMPOTENCY_KEY, true);
