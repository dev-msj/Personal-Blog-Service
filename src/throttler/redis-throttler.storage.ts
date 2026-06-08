import { ThrottlerStorage } from '@nestjs/throttler';
import type * as Redis from 'ioredis';

// ThrottlerStorageRecord는 @nestjs/throttler barrel에서 export되지 않으므로
// increment 반환 타입에서 구조적으로 도출한다.
type ThrottlerStorageRecord = Awaited<
  ReturnType<ThrottlerStorage['increment']>
>;

/**
 * 단일 REDIS_CLIENT(ioredis@4)를 재사용하는 직접 구현 ThrottlerStorage.
 *
 * `@nest-lab/throttler-storage-redis`는 peerDeps로 ioredis>=5를 요구하나
 * 본 프로젝트는 cache-manager-ioredis 결속으로 ioredis@4에 고정되어 있어
 * (이슈 #133 블로커 평가) 직접 구현으로 기존 ioredis 인스턴스를 재사용한다.
 *
 * INCR + PEXPIRE + PTTL을 Lua 스크립트로 원자 실행하여 요청 경합에서도
 * 카운터 일관성을 보장한다. 반환 시간 단위는 초(@nestjs/throttler 계약).
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  // KEYS[1] counter, KEYS[2] block / ARGV[1] ttl(ms), ARGV[2] limit, ARGV[3] blockDuration(ms)
  private static readonly INCREMENT_SCRIPT = `
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

-- 이미 차단 중이면 카운터를 더 늘리지 않고 차단 상태를 반환.
-- counter 키가 먼저 만료되고 block 키만 생존한 경계에서는 실제 누적값을 잃어
-- hits를 limit으로 폴백한다(차단 상태라 Remaining=0이 의미상 정확). V1은
-- blockDuration=ttl이라 두 키가 거의 동시 만료되어 이 경계가 드물다.
-- TODO(#133 V2): blockDuration>ttl 정책 도입 시 누적 카운트 보존 방식 재검토.
local blockPttl = redis.call('PTTL', KEYS[2])
if blockPttl > 0 then
  local hits = tonumber(redis.call('GET', KEYS[1])) or limit
  local pttl = redis.call('PTTL', KEYS[1])
  if pttl < 0 then pttl = blockPttl end
  return {hits, pttl, 1, blockPttl}
end

local totalHits = redis.call('INCR', KEYS[1])
local timeToExpire = redis.call('PTTL', KEYS[1])
if timeToExpire <= 0 then
  redis.call('PEXPIRE', KEYS[1], ttl)
  timeToExpire = ttl
end

local isBlocked = 0
local timeToBlockExpire = 0
if totalHits > limit then
  isBlocked = 1
  redis.call('SET', KEYS[2], '1', 'PX', blockDuration)
  timeToBlockExpire = blockDuration
end

return {totalHits, timeToExpire, isBlocked, timeToBlockExpire}
`;

  constructor(private readonly redis: Redis.Redis) {}

  // throttlerName(5번째 파라미터)은 본 구현에서 사용하지 않으므로 생략한다
  // (ThrottlerStorage 인터페이스는 더 적은 수의 파라미터 구현을 허용).
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    const counterKey = `throttle:${key}`;
    const blockKey = `throttle:block:${key}`;

    const [totalHits, timeToExpireMs, isBlocked, timeToBlockExpireMs] =
      (await this.redis.eval(
        RedisThrottlerStorage.INCREMENT_SCRIPT,
        2,
        counterKey,
        blockKey,
        ttl,
        limit,
        blockDuration,
      )) as [number, number, number, number];

    return {
      totalHits,
      timeToExpire: this.msToSeconds(timeToExpireMs),
      isBlocked: isBlocked === 1,
      timeToBlockExpire: this.msToSeconds(timeToBlockExpireMs),
    };
  }

  private msToSeconds(ms: number): number {
    return ms > 0 ? Math.ceil(ms / 1000) : 0;
  }
}
