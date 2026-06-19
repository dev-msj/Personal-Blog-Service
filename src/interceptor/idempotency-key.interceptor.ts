import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Request, Response } from 'express';
import { from, Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ErrorCode } from '../constant/error-code.enum';
import { FailureResponse } from '../response/failure-response.dto';
import { SKIP_IDEMPOTENCY_KEY } from '../decorator/skip-idempotency.decorator';
import { IdempotencyService } from '../idempotency/idempotency.service';

/**
 * API 수신 측 Idempotency-Key 처리 인터셉터 (DT-1 / flows/idempotency-key-handle.md).
 *
 * 전역 APP_INTERCEPTOR로 등록되며 AuthGuard 후행이다(NestJS Guard→Interceptor 순서).
 * AuthGuard가 주입한 신뢰 헤더 authenticatedUser(uid)로 user 네임스페이스를 결정한다.
 *
 * DT-1 분기:
 * - R1: 키 미제공 → 즉시 next.handle() 위임 (Redis 미접근, 캐싱 없음)
 * - R2: 키 + miss → setPending(락 획득) → 처리 → setCompleted
 * - R3: 키 + completed → 원본 응답 즉시 재반환 (핸들러 미진입)
 * - R4: 키 + pending → IDEMPOTENCY_IN_PROGRESS + Retry-After:5 (핸들러 미진입)
 * - 키 충돌(동일 키, 다른 method/path) → COMMON_BAD_REQUEST + Warning 로그
 *
 * 즉시 반환(R3/R4/충돌/형식위반)은 throw가 아닌 of()로 직접 응답을 흘린다.
 * Retry-After 헤더는 ExceptionFilter가 다루지 않으므로 res.setHeader로 직접 설정한다.
 */
@Injectable()
export class IdempotencyKeyInterceptor implements NestInterceptor {
  // RFC 4122 UUID v4 (version nibble 4, variant 8/9/a/b)
  private static readonly UUID_V4_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private static readonly HEADER = 'idempotency-key';

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
    private readonly reflector: Reflector,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_IDEMPOTENCY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const key = this.extractKey(request);
    // R1: 키 미제공 → 즉시 위임, Redis 미접근
    if (key === undefined) {
      return next.handle();
    }

    // 형식 위반(non-UUID v4) → COMMON_BAD_REQUEST
    if (!IdempotencyKeyInterceptor.UUID_V4_REGEX.test(key)) {
      return of(
        new FailureResponse(
          ErrorCode.COMMON_BAD_REQUEST,
          'Idempotency-Key must be a valid UUID v4.',
        ),
      );
    }

    // authUserId 부재(미인증/@Public) → R1로 처리 (정책상 미적용, IP 대체 키 없음)
    const authUserId = this.extractAuthUserId(request);
    if (authUserId === undefined) {
      return next.handle();
    }

    const method = request.method;
    const path = request.path;

    return from(this.idempotencyService.get(authUserId, key)).pipe(
      switchMap((record) => {
        if (record !== null) {
          // 키 충돌: 동일 키, 다른 method/path
          if (record.method !== method || record.path !== path) {
            this.logger.warn(
              `Idempotency-Key reused on different endpoint. - [${JSON.stringify(
                {
                  user: authUserId,
                  requested: { method, path },
                  cached: { method: record.method, path: record.path },
                },
              )}]`,
            );
            return of(
              new FailureResponse(
                ErrorCode.COMMON_BAD_REQUEST,
                'Idempotency-Key was already used for a different request.',
              ),
            );
          }

          // R4: pending → IDEMPOTENCY_IN_PROGRESS + Retry-After:5
          if (record.state === 'pending') {
            response.setHeader('Retry-After', '5');
            return of(
              new FailureResponse(
                ErrorCode.IDEMPOTENCY_IN_PROGRESS,
                'A request with the same Idempotency-Key is in progress.',
              ),
            );
          }

          // R3: completed → 원본 응답 즉시 재반환 (핸들러 미진입)
          return of(record.responseBody);
        }

        // R2 후보: pending 락 시도
        return from(
          this.idempotencyService.setPending(authUserId, key, method, path),
        ).pipe(
          switchMap((acquired) => {
            // SET NX 경합 패: 동시 요청이 먼저 락 획득 → R4 처리
            if (!acquired) {
              response.setHeader('Retry-After', '5');
              return of(
                new FailureResponse(
                  ErrorCode.IDEMPOTENCY_IN_PROGRESS,
                  'A request with the same Idempotency-Key is in progress.',
                ),
              );
            }

            // R2: 정상 처리 후 completed 캐싱
            return next
              .handle()
              .pipe(
                switchMap((body) =>
                  from(
                    this.idempotencyService.setCompleted(
                      authUserId,
                      key,
                      method,
                      path,
                      response.statusCode,
                      body,
                    ),
                  ).pipe(switchMap(() => of(body))),
                ),
              );
          }),
        );
      }),
    );
  }

  private extractKey(request: Request): string | undefined {
    const raw = request.headers[IdempotencyKeyInterceptor.HEADER];
    if (Array.isArray(raw)) {
      return raw[0];
    }
    return raw;
  }

  private extractAuthUserId(request: Request): string | undefined {
    const raw = request.headers['authenticatedUser'];
    if (Array.isArray(raw)) {
      return raw[0];
    }
    return raw;
  }
}
