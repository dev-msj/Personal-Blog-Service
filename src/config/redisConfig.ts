import { CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import * as Redis from 'ioredis';
import * as redisStore from 'cache-manager-ioredis';
import { RedisModule } from '../redis/redis.module';
import { REDIS_CLIENT } from '../redis/redis.providers';

// REDIS_CLIENT 인스턴스를 cache-manager-ioredis가 새 클라이언트 생성 없이 그대로 사용하도록
// redisInstance 옵션으로 전달한다 (cache-manager-ioredis index.js:6).
// 이로써 NestJS CacheModule 경로(비즈니스 캐시)와 health 경로가 동일 ioredis 연결을 공유한다.
// production 환경의 TypeORM 쿼리 캐시(typeOrmConfig.cache)는 별도 ioredis 클라이언트로 동작하며,
// 본 단일화 범위 외다 (Phase 2 observability 또는 Phase 4 부하 테스트 시점에 health indicator 통합 또는
// 클라이언트 공유 여부를 재판단).
// TODO(#92 deep-review): CACHE_MANAGER 직접 inject로 cache-manager API를 사용하는 코드를 추가할 때,
// redisCache.options.ttl이 undefined로 동작하는 점을 함께 검토. cache-manager-ioredis는 set 호출 시
// options.ttl || storeArgs.ttl을 참조하므로(index.js:44), default TTL이 필요한 경우 호출 시점에 명시하거나
// redisInstance 외부에서 별도 storeArgs.ttl을 주입하는 방식으로 처리.
export const redisConfig: CacheModuleAsyncOptions = {
  isGlobal: true,
  imports: [RedisModule],
  inject: [REDIS_CLIENT],
  useFactory: (redisInstance: Redis.Redis) => ({
    store: redisStore,
    redisInstance,
  }),
};
