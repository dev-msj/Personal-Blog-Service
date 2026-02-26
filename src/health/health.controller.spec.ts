import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import {
  HealthCheckError,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { RedisHealthIndicator } from './indicator/redis.health-indicator';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;
  let mockRes: { status: jest.Mock; json: jest.Mock };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: { check: jest.fn() },
        },
        {
          provide: TypeOrmHealthIndicator,
          useValue: { pingCheck: jest.fn() },
        },
        {
          provide: RedisHealthIndicator,
          useValue: { isHealthy: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(HealthController);
    healthCheckService = module.get(HealthCheckService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it('모든 헬스체크 통과 시 HTTP 200을 반환한다', async () => {
    const healthResult = {
      status: 'ok',
      info: {
        database: { status: 'up' },
        redis: { status: 'up' },
      },
      error: {},
      details: {
        database: { status: 'up' },
        redis: { status: 'up' },
      },
    };
    (healthCheckService.check as jest.Mock).mockResolvedValue(healthResult);

    await controller.check(mockRes as any);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(healthResult);
  });

  it('DB 헬스체크 실패 시 HTTP 503을 반환한다', async () => {
    const errorResponse = {
      status: 'error',
      info: { redis: { status: 'up' } },
      error: { database: { status: 'down' } },
      details: {
        redis: { status: 'up' },
        database: { status: 'down' },
      },
    };
    (healthCheckService.check as jest.Mock).mockRejectedValue(
      new HealthCheckError('Health check failed', errorResponse),
    );

    await controller.check(mockRes as any);

    expect(mockRes.status).toHaveBeenCalledWith(503);
    expect(mockRes.json).toHaveBeenCalledWith(errorResponse);
  });

  it('Redis 헬스체크 실패 시 HTTP 503을 반환한다', async () => {
    const errorResponse = {
      status: 'error',
      info: { database: { status: 'up' } },
      error: { redis: { status: 'down' } },
      details: {
        database: { status: 'up' },
        redis: { status: 'down' },
      },
    };
    (healthCheckService.check as jest.Mock).mockRejectedValue(
      new HealthCheckError('Health check failed', errorResponse),
    );

    await controller.check(mockRes as any);

    expect(mockRes.status).toHaveBeenCalledWith(503);
    expect(mockRes.json).toHaveBeenCalledWith(errorResponse);
  });

  it('예상치 못한 에러 시 HTTP 503을 반환한다', async () => {
    (healthCheckService.check as jest.Mock).mockRejectedValue(
      new Error('Unexpected error'),
    );

    await controller.check(mockRes as any);

    expect(mockRes.status).toHaveBeenCalledWith(503);
    expect(mockRes.json).toHaveBeenCalledWith({
      status: 'error',
      error: { message: 'Unexpected error' },
    });
  });
});
