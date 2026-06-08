import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * 전역 Rate Limiting Guard.
 *
 * getTracker를 오버라이드하여 인증된 요청은 user_id, 미인증 요청은 IP를
 * 제한 단위로 사용한다 (security.md §5.2). 인증 user_id는 AuthGuard가 주입한
 * `req.headers['authenticatedUser']`(uid)에서 얻으므로, app.module providers에서
 * AuthGuard가 본 Guard보다 먼저 등록되어야 한다(전역 Guard는 등록 순서대로 실행).
 *
 * 429 응답: base ThrottlerGuard가 setHeaders 기본값(true)으로 `Retry-After`
 * 헤더를 throw 직전 설정하고 ThrottlerException(HttpException 429)을 throw한다.
 * 본문 변환(HTTP 200 + FailureResponse(COMMON_TOO_MANY_REQUESTS))은
 * HttpExceptionFilter가 담당한다.
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // authenticatedUser는 AuthGuard가 토큰 검증 후 주입하는 신뢰값(단일 string)이며
    // AuthGuard가 진입 시 외부 위조 헤더를 strip하므로 string|undefined만 흘러든다.
    // 헤더 정적 타입(string|string[])상 방어적으로, string이 아니면 IP로 폴백한다.
    const userId = req.headers?.['authenticatedUser'];

    return typeof userId === 'string' ? `user:${userId}` : `ip:${req.ip}`;
  }
}
