import { Test } from '@nestjs/testing';
import { RedisHealthIndicator } from './redis.health-indicator';
import { HealthCheckError } from '@nestjs/terminus';
import { REDIS_CLIENT } from '../../redis/redis.providers';

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let mockPing: jest.Mock;

  beforeAll(async () => {
    mockPing = jest.fn();

    const module = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        {
          provide: REDIS_CLIENT,
          useValue: {
            ping: mockPing,
          },
        },
      ],
    }).compile();

    indicator = module.get(RedisHealthIndicator);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Redis 연결 정상 시 up 상태를 반환한다', async () => {
    mockPing.mockResolvedValue('PONG');

    const result = await indicator.isHealthy('redis');

    expect(result).toEqual({ redis: { status: 'up' } });
    expect(mockPing).toHaveBeenCalledTimes(1);
  });

  it('Redis 연결 실패 시 HealthCheckError를 던진다', async () => {
    mockPing.mockRejectedValue(new Error('Connection refused'));

    await expect(indicator.isHealthy('redis')).rejects.toThrow(
      HealthCheckError,
    );
    await expect(indicator.isHealthy('redis')).rejects.toThrow(
      'Redis health check failed: Connection refused',
    );
  });
});
