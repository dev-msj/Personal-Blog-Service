import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../decorator/public.decorator';
import { RedisHealthIndicator } from './indicator/redis.health-indicator';

@Public()
@Controller('health')
export class HealthController {
  constructor(
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
      if (error instanceof HealthCheckError) {
        res.status(503).json(error.causes);
      } else {
        res.status(503).json({
          status: 'error',
          error: { message: (error as Error).message },
        });
      }
    }
  }
}
