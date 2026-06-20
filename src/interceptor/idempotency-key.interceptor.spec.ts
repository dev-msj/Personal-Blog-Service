import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { firstValueFrom, lastValueFrom, of, throwError } from 'rxjs';
import { IdempotencyKeyInterceptor } from './idempotency-key.interceptor';
import { IdempotencyService } from '../idempotency/idempotency.service';
import {
  IdempotencyInProgressException,
  IdempotentReplayException,
} from '../exception/idempotency';
import { BaseException } from '../exception/base.exception';
import { ErrorCode } from '../constant/error-code.enum';

const VALID_UUID_V4 = '3f29c1a0-8b4e-4c2a-9f7d-1a2b3c4d5e6f';

// 핸들러가 throw하는 도메인 예외 모사(BaseException 서브클래스)
class FakePostNotFoundException extends BaseException {
  constructor() {
    super(ErrorCode.POST_NOT_FOUND, 'Post does not exist! - [999]');
  }
}

describe('IdempotencyKeyInterceptor', () => {
  let interceptor: IdempotencyKeyInterceptor;
  let reflector: { getAllAndOverride: jest.Mock };
  let idempotencyService: {
    get: jest.Mock;
    setPending: jest.Mock;
    setCompleted: jest.Mock;
    setCompletedFailure: jest.Mock;
  };
  let logger: { warn: jest.Mock };

  const setHeader = jest.fn();

  const buildContext = (
    headers: Record<string, string | undefined>,
    method = 'POST',
    path = '/posts',
  ): ExecutionContext => {
    const request = { headers, method, path };
    const response = { setHeader, statusCode: 200 };
    return {
      getHandler: () => function handler() {},
      getClass: () => class Ctrl {},
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  };

  const buildNext = (returnValue: unknown): CallHandler => ({
    handle: jest.fn(() => of(returnValue)),
  });

  // 핸들러가 에러 observable을 내보내는 CallHandler 모사
  const buildNextThrow = (err: unknown): CallHandler => ({
    handle: jest.fn(() => throwError(() => err)),
  });

  beforeEach(async () => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    idempotencyService = {
      get: jest.fn(),
      setPending: jest.fn(),
      setCompleted: jest.fn(),
      setCompletedFailure: jest.fn(),
    };
    logger = { warn: jest.fn() };
    setHeader.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyKeyInterceptor,
        { provide: Reflector, useValue: reflector },
        { provide: WINSTON_MODULE_PROVIDER, useValue: logger },
        { provide: IdempotencyService, useValue: idempotencyService },
      ],
    }).compile();

    interceptor = module.get(IdempotencyKeyInterceptor);
  });

  describe('@SkipIdempotency', () => {
    it('skip=true이면 즉시 next.handle, Redis 미접근', async () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const next = buildNext('handler-result');

      const result = await firstValueFrom(
        interceptor.intercept(buildContext({}), next),
      );

      expect(result).toBe('handler-result');
      expect(idempotencyService.get).not.toHaveBeenCalled();
    });
  });

  describe('TC-IDEM-02 DT-1 R1 (키 미제공)', () => {
    it('Idempotency-Key 헤더 부재 시 즉시 next.handle, Redis 미호출', async () => {
      const next = buildNext('handler-result');

      const result = await firstValueFrom(
        interceptor.intercept(buildContext({}), next),
      );

      expect(result).toBe('handler-result');
      expect(next.handle).toHaveBeenCalledTimes(1);
      expect(idempotencyService.get).not.toHaveBeenCalled();
      expect(idempotencyService.setPending).not.toHaveBeenCalled();
    });
  });

  describe('TC-IDEM-07 헤더 형식 위반', () => {
    // 형식 위반은 intercept 진입부에서 동기 throw → HttpExceptionFilter가 COMMON_BAD_REQUEST 변환
    it('non-UUID v4 → BadRequestException 동기 throw, next.handle 미진입', () => {
      const next = buildNext('handler-result');

      expect(() =>
        interceptor.intercept(
          buildContext({ 'idempotency-key': 'not-a-uuid' }),
          next,
        ),
      ).toThrow(BadRequestException);

      expect(next.handle).not.toHaveBeenCalled();
      expect(idempotencyService.get).not.toHaveBeenCalled();
    });

    it('UUID v4가 아닌 v1(version nibble != 4) → BadRequestException', () => {
      const next = buildNext('x');
      const v1 = '3f29c1a0-8b4e-1c2a-9f7d-1a2b3c4d5e6f'; // version 1

      expect(() =>
        interceptor.intercept(buildContext({ 'idempotency-key': v1 }), next),
      ).toThrow(BadRequestException);
    });
  });

  describe('authUserId 부재 (미인증/@Public)', () => {
    it('유효 키지만 authenticatedUser 헤더 부재 → R1 처리 (캐싱 없음)', async () => {
      const next = buildNext('handler-result');

      const result = await firstValueFrom(
        interceptor.intercept(
          buildContext({ 'idempotency-key': VALID_UUID_V4 }),
          next,
        ),
      );

      expect(result).toBe('handler-result');
      expect(idempotencyService.get).not.toHaveBeenCalled();
    });
  });

  describe('DT-1 R2 (키 + miss → 처리 + 캐싱)', () => {
    it('miss + 락 획득 시 next.handle 후 setCompleted 캐싱', async () => {
      idempotencyService.get.mockResolvedValue(null);
      idempotencyService.setPending.mockResolvedValue(true);
      idempotencyService.setCompleted.mockResolvedValue(undefined);
      const next = buildNext({ code: 200, data: 'ok' });

      const result = await firstValueFrom(
        interceptor.intercept(
          buildContext({
            'idempotency-key': VALID_UUID_V4,
            authenticatedUser: 'user-1',
          }),
          next,
        ),
      );

      expect(result).toEqual({ code: 200, data: 'ok' });
      expect(idempotencyService.setPending).toHaveBeenCalledWith(
        'user-1',
        VALID_UUID_V4,
        'POST',
        '/posts',
      );
      expect(idempotencyService.setCompleted).toHaveBeenCalledWith(
        'user-1',
        VALID_UUID_V4,
        'POST',
        '/posts',
        200,
        { code: 200, data: 'ok' },
      );
    });
  });

  describe('DT-1 R3 (키 + completed → 재반환)', () => {
    it('completed + method/path 일치 → 저장된 응답 재반환, next.handle 미진입', async () => {
      idempotencyService.get.mockResolvedValue({
        state: 'completed',
        method: 'POST',
        path: '/posts',
        processedAt: 'x',
        statusCode: 200,
        responseBody: { code: 200, data: 'cached' },
      });
      const next = buildNext('fresh');

      const result = await firstValueFrom(
        interceptor.intercept(
          buildContext({
            'idempotency-key': VALID_UUID_V4,
            authenticatedUser: 'user-1',
          }),
          next,
        ),
      );

      expect(result).toEqual({ code: 200, data: 'cached' });
      expect(next.handle).not.toHaveBeenCalled();
      expect(idempotencyService.setPending).not.toHaveBeenCalled();
    });
  });

  describe('DT-1 R4 (키 + pending → IN_PROGRESS)', () => {
    // R4는 switchMap 안에서 throw → observable error notification → 필터(90009)로 전달
    it('pending → IdempotencyInProgressException + Retry-After:5, 핸들러 미진입', async () => {
      idempotencyService.get.mockResolvedValue({
        state: 'pending',
        method: 'POST',
        path: '/posts',
        processedAt: 'x',
      });
      const next = buildNext('fresh');

      await expect(
        lastValueFrom(
          interceptor.intercept(
            buildContext({
              'idempotency-key': VALID_UUID_V4,
              authenticatedUser: 'user-1',
            }),
            next,
          ),
        ),
      ).rejects.toBeInstanceOf(IdempotencyInProgressException);

      // Retry-After는 throw 전에 setHeader로 설정(Express가 필터 응답에도 보존)
      expect(setHeader).toHaveBeenCalledWith('Retry-After', '5');
      expect(next.handle).not.toHaveBeenCalled();
    });

    it('setPending 경합 패배(acquired=false) → IN_PROGRESS + Retry-After:5', async () => {
      idempotencyService.get.mockResolvedValue(null);
      idempotencyService.setPending.mockResolvedValue(false);
      const next = buildNext('fresh');

      await expect(
        lastValueFrom(
          interceptor.intercept(
            buildContext({
              'idempotency-key': VALID_UUID_V4,
              authenticatedUser: 'user-1',
            }),
            next,
          ),
        ),
      ).rejects.toBeInstanceOf(IdempotencyInProgressException);

      expect(setHeader).toHaveBeenCalledWith('Retry-After', '5');
      expect(next.handle).not.toHaveBeenCalled();
    });
  });

  describe('키 충돌 (동일 키, 다른 method/path)', () => {
    it('cached method/path 불일치 → BadRequestException + Warning 로그', async () => {
      idempotencyService.get.mockResolvedValue({
        state: 'completed',
        method: 'POST',
        path: '/posts',
        processedAt: 'x',
        statusCode: 200,
        responseBody: {},
      });
      const next = buildNext('fresh');

      await expect(
        lastValueFrom(
          interceptor.intercept(
            buildContext(
              {
                'idempotency-key': VALID_UUID_V4,
                authenticatedUser: 'user-1',
              },
              'DELETE',
              '/posts/1',
            ),
            next,
          ),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(next.handle).not.toHaveBeenCalled();
    });
  });

  describe('flow §3.3 핸들러 실패 시 캐싱 (R2 catchError)', () => {
    it('핸들러 BaseException throw → setCompletedFailure 캐싱 + 원본 에러 재전파', async () => {
      idempotencyService.get.mockResolvedValue(null);
      idempotencyService.setPending.mockResolvedValue(true);
      idempotencyService.setCompletedFailure.mockResolvedValue(undefined);
      const domainError = new FakePostNotFoundException();
      const next = buildNextThrow(domainError);

      await expect(
        lastValueFrom(
          interceptor.intercept(
            buildContext({
              'idempotency-key': VALID_UUID_V4,
              authenticatedUser: 'user-1',
            }),
            next,
          ),
        ),
      ).rejects.toBe(domainError); // 원본 에러 그대로 전파(필터가 변환)

      expect(idempotencyService.setCompletedFailure).toHaveBeenCalledWith(
        'user-1',
        VALID_UUID_V4,
        'POST',
        '/posts',
        ErrorCode.POST_NOT_FOUND,
        'Post does not exist! - [999]',
      );
      expect(idempotencyService.setCompleted).not.toHaveBeenCalled();
    });

    it('핸들러 HttpException(NotFound) throw → COMMON_NOT_FOUND로 매핑 캐싱', async () => {
      idempotencyService.get.mockResolvedValue(null);
      idempotencyService.setPending.mockResolvedValue(true);
      idempotencyService.setCompletedFailure.mockResolvedValue(undefined);
      const httpError = new NotFoundException('nope');
      const next = buildNextThrow(httpError);

      await expect(
        lastValueFrom(
          interceptor.intercept(
            buildContext({
              'idempotency-key': VALID_UUID_V4,
              authenticatedUser: 'user-1',
            }),
            next,
          ),
        ),
      ).rejects.toBe(httpError);

      expect(idempotencyService.setCompletedFailure).toHaveBeenCalledWith(
        'user-1',
        VALID_UUID_V4,
        'POST',
        '/posts',
        ErrorCode.COMMON_NOT_FOUND,
        'nope',
      );
    });

    it('setCompletedFailure가 reject(Redis 장애)해도 원본 에러가 전파된다', async () => {
      idempotencyService.get.mockResolvedValue(null);
      idempotencyService.setPending.mockResolvedValue(true);
      idempotencyService.setCompletedFailure.mockRejectedValue(
        new Error('redis down'),
      );
      const domainError = new FakePostNotFoundException();
      const next = buildNextThrow(domainError);

      await expect(
        lastValueFrom(
          interceptor.intercept(
            buildContext({
              'idempotency-key': VALID_UUID_V4,
              authenticatedUser: 'user-1',
            }),
            next,
          ),
        ),
      ).rejects.toBe(domainError); // 캐싱 실패해도 원본 전파(pending TTL 폴백)
    });
  });

  describe('flow §3.3 R3 캐싱된 실패 재반환 (completed failed)', () => {
    it('completed(failed) → IdempotentReplayException(동일 errorCode/message) throw, 핸들러 미진입', async () => {
      idempotencyService.get.mockResolvedValue({
        state: 'completed',
        failed: true,
        errorCode: ErrorCode.POST_NOT_FOUND,
        message: 'Post does not exist! - [999]',
        method: 'POST',
        path: '/posts',
        processedAt: 'x',
      });
      const next = buildNext('fresh');

      await expect(
        lastValueFrom(
          interceptor.intercept(
            buildContext({
              'idempotency-key': VALID_UUID_V4,
              authenticatedUser: 'user-1',
            }),
            next,
          ),
        ),
      ).rejects.toBeInstanceOf(IdempotentReplayException);

      expect(next.handle).not.toHaveBeenCalled();
      expect(idempotencyService.setPending).not.toHaveBeenCalled();
    });
  });
});
