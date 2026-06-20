import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Request, Response } from 'express';
import { from, Observable, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ErrorCode } from '../constant/error-code.enum';
import { BaseException } from '../exception/base.exception';
import { SKIP_IDEMPOTENCY_KEY } from '../decorator/skip-idempotency.decorator';
import { IdempotencyService } from '../idempotency/idempotency.service';
import {
  IdempotencyInProgressException,
  IdempotentReplayException,
} from '../exception/idempotency';

/**
 * API 수신 측 Idempotency-Key 처리 인터셉터 (DT-1 / flows/idempotency-key-handle.md).
 *
 * 전역 APP_INTERCEPTOR로 등록되며 AuthGuard 후행이다(NestJS Guard→Interceptor 순서).
 * AuthGuard가 주입한 신뢰 헤더 authenticatedUser(uid)로 user 네임스페이스를 결정한다.
 *
 * DT-1 분기:
 * - R1: 키 미제공 → 즉시 next.handle() 위임 (Redis 미접근, 캐싱 없음)
 * - R2: 키 + miss → setPending(락 획득) → 처리 → setCompleted
 * - R3: 키 + completed → 캐싱된 응답 즉시 재반환 (핸들러 미진입). completed(failed)면
 *   캐싱된 errorCode/message로 동일 실패 재반환(throw 재구성, flow §3.3)
 * - R4: 키 + pending → IDEMPOTENCY_IN_PROGRESS + Retry-After:5 (핸들러 미진입)
 * - 키 충돌(동일 키, 다른 method/path) → COMMON_BAD_REQUEST + Warning 로그
 *
 * 실패 경로(형식위반/충돌/R4)는 throw로 처리한다. 본 프로젝트의 "실패=HTTP 200"
 * 규약은 throw → ExceptionFilter(res.status(200).json(FailureResponse)) 메커니즘으로
 * 달성된다. of(FailureResponse)를 정상 반환값으로 흘리면 NestJS가 라우트 status
 * (POST=201 등)를 적용해 규약을 우회하므로 금지한다.
 * - 형식위반/충돌 → BadRequestException (HttpExceptionFilter가 COMMON_BAD_REQUEST 변환)
 * - R4/락 경합 패 → IdempotencyInProgressException (BaseExceptionFilter가 90009 변환)
 * Retry-After 헤더는 throw 전에 res.setHeader로 설정한다. Express는 기존 헤더를
 * 삭제하지 않으므로 필터의 res.status(200).json()을 거쳐도 보존된다.
 * 정상 경로(R2 처리·캐싱, R3 재반환)만 of()로 흘린다.
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

    // 형식 위반(non-UUID v4) → HttpExceptionFilter가 COMMON_BAD_REQUEST로 변환
    if (!IdempotencyKeyInterceptor.UUID_V4_REGEX.test(key)) {
      throw new BadRequestException('Idempotency-Key must be a valid UUID v4.');
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
          // 키 충돌: 동일 키, 다른 method/path → BadRequestException
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
            throw new BadRequestException(
              'Idempotency-Key was already used for a different request.',
            );
          }

          // R4: pending → IdempotencyInProgressException + Retry-After:5
          if (record.state === 'pending') {
            response.setHeader('Retry-After', '5');
            throw new IdempotencyInProgressException();
          }

          // R3: completed → 캐싱된 응답 즉시 재반환 (핸들러 미진입)
          // 실패 스냅샷이면 동일 errorCode/message로 재구성 throw (flow §3.3)
          if (record.failed) {
            throw new IdempotentReplayException(
              record.errorCode as ErrorCode,
              record.message as string,
            );
          }
          // 성공 재반환은 body만 흘린다. 캐싱된 statusCode는 of()로 적용 불가다 —
          // NestJS가 of() 반환값에 라우트 기본 status를 적용하므로(동일 키=동일
          // 라우트 재요청이라 원본과 일치), record.statusCode는 관측용 보존 필드다.
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
              throw new IdempotencyInProgressException();
            }

            // R2: 정상 처리 후 completed 캐싱. 성공은 setCompleted, 실패(throw)는
            // catchError에서 setCompletedFailure로 스냅샷 저장 후 원본 에러 전파.
            return next.handle().pipe(
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
                ).pipe(
                  // 캐싱 실패(Redis 장애) 시 pending TTL 폴백 — 성공 응답은 그대로
                  // 반환한다(flow §3.3 L136: pending→completed 전환 실패는 성공/실패
                  // 공통 TTL 폴백). 이 inner catchError가 없으면 setCompleted reject가
                  // 외부 실패 catchError로 흘러 (1) 성공한 요청이 500으로 응답되고
                  // (2) 성공 요청에 실패 스냅샷이 캐싱되는 오분류가 발생한다.
                  catchError(() => of(null)),
                  switchMap(() => of(body)),
                ),
              ),
              catchError((err) => {
                const { errorCode, message } = this.toFailure(err);
                return from(
                  this.idempotencyService.setCompletedFailure(
                    authUserId,
                    key,
                    method,
                    path,
                    errorCode,
                    message,
                  ),
                ).pipe(
                  // 캐싱 실패(Redis 장애) 시 pending TTL 폴백 — 원본 에러는 항상 전파
                  catchError(() => of(null)),
                  switchMap(() => throwError(() => err)),
                );
              }),
            );
          }),
        );
      }),
    );
  }

  /**
   * 핸들러 throw를 캐싱용 { errorCode, message }로 매핑한다.
   *
   * HttpException 분기는 HttpExceptionFilter.mapToErrorCode/getMessage의 미러다 —
   * 인터셉터는 NestJS 파이프라인상 ExceptionFilter 하류라 필터가 변환한 응답을
   * 직접 수신하지 못하므로(catchError로 원본 예외만 받음), 같은 매핑을 직접 수행해
   * 실패 스냅샷을 캐싱한다.
   */
  private toFailure(err: unknown): { errorCode: ErrorCode; message: string } {
    if (err instanceof BaseException) {
      return { errorCode: err.errorCode, message: err.message };
    }
    if (err instanceof HttpException) {
      return {
        errorCode: this.mapHttpStatusToErrorCode(err.getStatus()),
        message: this.getMessage(err.getResponse()),
      };
    }
    return {
      errorCode: ErrorCode.COMMON_INTERNAL_ERROR,
      message: 'Internal server error',
    };
  }

  // HttpExceptionFilter.mapToErrorCode 미러 — 인터셉터가 필터 하류라 직접 매핑 필요.
  private mapHttpStatusToErrorCode(status: number): ErrorCode {
    const mapping: Record<number, ErrorCode> = {
      [HttpStatus.BAD_REQUEST]: ErrorCode.COMMON_BAD_REQUEST,
      [HttpStatus.UNAUTHORIZED]: ErrorCode.COMMON_UNAUTHORIZED,
      [HttpStatus.NOT_FOUND]: ErrorCode.COMMON_NOT_FOUND,
      [HttpStatus.NOT_ACCEPTABLE]: ErrorCode.COMMON_NOT_ACCEPTABLE,
      [HttpStatus.CONFLICT]: ErrorCode.COMMON_CONFLICT,
      [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.COMMON_TOO_MANY_REQUESTS,
      [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorCode.COMMON_INTERNAL_ERROR,
      [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.COMMON_SERVICE_UNAVAILABLE,
    };
    return mapping[status] ?? ErrorCode.COMMON_INTERNAL_ERROR;
  }

  // HttpExceptionFilter.getMessage 미러.
  private getMessage(response: string | object): string {
    if (typeof response === 'string') {
      return response;
    }
    const message = (response as Record<string, unknown>).message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    return typeof message === 'string' ? message : '';
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
