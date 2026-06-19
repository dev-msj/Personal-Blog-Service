import { Test, TestingModule } from '@nestjs/testing';
import type * as Redis from 'ioredis';
import { IdempotencyService } from './idempotency.service';
import { REDIS_CLIENT } from '../redis/redis.providers';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let mockRedis: {
    get: jest.Mock;
    set: jest.Mock;
    eval: jest.Mock;
  };

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      eval: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis as unknown as Redis.Redis,
        },
      ],
    }).compile();

    service = module.get(IdempotencyService);
  });

  describe('get', () => {
    it('키가 없으면 null을 반환한다', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get('user-1', 'key-1');

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith('idempotency:user-1:key-1');
    });

    it('저장된 JSON을 IdempotencyRecord로 파싱한다', async () => {
      const stored = {
        state: 'completed',
        method: 'POST',
        path: '/posts',
        processedAt: '2026-06-20T00:00:00.000Z',
        statusCode: 200,
        responseBody: { code: 200 },
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(stored));

      const result = await service.get('user-1', 'key-1');

      expect(result).toEqual(stored);
    });
  });

  describe('setPending', () => {
    it('SET NX EX Lua eval로 키 + JSON + TTL 86400을 전달한다', async () => {
      mockRedis.eval.mockResolvedValue(1);

      await service.setPending('user-1', 'key-1', 'POST', '/posts');

      expect(mockRedis.eval).toHaveBeenCalledTimes(1);
      const args = mockRedis.eval.mock.calls[0];
      // args: [script, numKeys, key, jsonValue, ttl]
      expect(args[1]).toBe(1);
      expect(args[2]).toBe('idempotency:user-1:key-1');
      const parsed = JSON.parse(args[3] as string);
      expect(parsed.state).toBe('pending');
      expect(parsed.method).toBe('POST');
      expect(parsed.path).toBe('/posts');
      expect(parsed.processedAt).toEqual(expect.any(String));
      expect(args[4]).toBe(86400);
    });

    it('신규 획득(eval=1)이면 true를 반환한다', async () => {
      mockRedis.eval.mockResolvedValue(1);

      const acquired = await service.setPending('u', 'k', 'POST', '/p');

      expect(acquired).toBe(true);
    });

    it('이미 존재(eval=0, 동시 요청)면 false를 반환한다 — R4 식별', async () => {
      mockRedis.eval.mockResolvedValue(0);

      const acquired = await service.setPending('u', 'k', 'POST', '/p');

      expect(acquired).toBe(false);
    });
  });

  describe('setCompleted', () => {
    it('completed 레코드를 method/path/statusCode/body 포함하여 SET EX 86400 한다', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.setCompleted('user-1', 'key-1', 'POST', '/posts', 200, {
        code: 200,
        data: { id: 1 },
      });

      expect(mockRedis.set).toHaveBeenCalledTimes(1);
      const [key, json, exFlag, ttl] = mockRedis.set.mock.calls[0];
      expect(key).toBe('idempotency:user-1:key-1');
      const parsed = JSON.parse(json as string);
      expect(parsed.state).toBe('completed');
      expect(parsed.method).toBe('POST');
      expect(parsed.path).toBe('/posts');
      expect(parsed.statusCode).toBe(200);
      expect(parsed.responseBody).toEqual({ code: 200, data: { id: 1 } });
      expect(exFlag).toBe('EX');
      expect(ttl).toBe(86400);
    });
  });
});
