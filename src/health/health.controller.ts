import {
  Controller,
  Get,
  Inject,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Response } from 'express';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Public } from '../decorator/public.decorator';
import { RedisHealthIndicator } from './indicator/redis.health-indicator';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  async check(@Res() res: Response): Promise<void> {
    try {
      const result = await this.health.check([
        () => this.db.pingCheck('database'),
        () => this.redis.isHealthy('redis'),
      ]);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        const result = error.getResponse();
        this.logger.warn(`Health check failed`, { result });
        res.status(503).json(result);
      } else {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Unexpected health check error: ${message}`, {
          error,
        });
        res.status(503).json({
          status: 'error',
          error: { message },
        });
      }
    }
  }
}
