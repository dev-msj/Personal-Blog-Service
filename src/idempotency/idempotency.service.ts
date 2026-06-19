import { Inject, Injectable } from '@nestjs/common';
import type * as Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.providers';

export type IdempotencyState = 'pending' | 'completed';

/**
 * Redis JSON 값 (data-design.md §Redis 키 구조 / implementation-guide.md §6.3).
 * pending 시점에는 statusCode/responseBody가 아직 없으므로 optional.
 */
export interface IdempotencyRecord {
  state: IdempotencyState;
  method: string;
  path: string;
  processedAt: string;
  statusCode?: number;
  responseBody?: unknown;
}

/**
 * API 수신 측 Idempotency-Key 저장소 (security.md §8 [확정]).
 *
 * 키: idempotency:{user_id}:{key}, 값: JSON IdempotencyRecord, TTL 24h.
 * 상태 전이는 단방향: [absent] --setPending(SET NX)--> pending
 * --setCompleted(SET)--> completed --TTL--> [absent] (guide §7.1).
 *
 * setPending은 SET NX EX를 단일 Lua eval로 원자 실행한다. SETNX+EXPIRE
 * 2-command 분리는 두 명령 사이 크래시 시 TTL 없는 영구 키를 남기므로
 * 금지한다 (RedisThrottlerStorage의 Lua 원자성 패턴과 일관).
 */
@Injectable()
export class IdempotencyService {
  // KEYS[1] idempotency 키 / ARGV[1] JSON 값, ARGV[2] TTL(초)
  // SET NX EX 단일 명령을 Lua로 감싸 원자 실행. 신규 획득 시 1, 이미 존재 시 0.
  private static readonly SET_PENDING_SCRIPT = `
local ok = redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', tonumber(ARGV[2]))
if ok then
  return 1
end
return 0
`;

  private static readonly TTL_SECONDS = 86400;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis.Redis,
  ) {}

  private buildKey(userId: string, key: string): string {
    return `idempotency:${userId}:${key}`;
  }

  async get(userId: string, key: string): Promise<IdempotencyRecord | null> {
    const raw = await this.redis.get(this.buildKey(userId, key));
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw) as IdempotencyRecord;
  }

  /**
   * pending 락 획득. 신규 획득(키 부재)이면 true, 이미 존재(동시 요청)면 false.
   * R4(in-flight) 분기는 이 false 반환으로 식별한다.
   */
  async setPending(
    userId: string,
    key: string,
    method: string,
    path: string,
  ): Promise<boolean> {
    const record: IdempotencyRecord = {
      state: 'pending',
      method,
      path,
      processedAt: new Date().toISOString(),
    };

    const acquired = (await this.redis.eval(
      IdempotencyService.SET_PENDING_SCRIPT,
      1,
      this.buildKey(userId, key),
      JSON.stringify(record),
      IdempotencyService.TTL_SECONDS,
    )) as number;

    return acquired === 1;
  }

  /**
   * completed로 전환 + 응답 스냅샷 저장. pending이 이미 method/path를 가지므로
   * 동일 키 재호출 시 method/path 정합성은 setPending 시점 값으로 유지된다.
   * 성공/실패 응답 무관하게 캐싱한다 (flow §3.3 "같은 키로 같은 결과 보장").
   */
  async setCompleted(
    userId: string,
    key: string,
    method: string,
    path: string,
    statusCode: number,
    body: unknown,
  ): Promise<void> {
    const record: IdempotencyRecord = {
      state: 'completed',
      method,
      path,
      processedAt: new Date().toISOString(),
      statusCode,
      responseBody: body,
    };

    await this.redis.set(
      this.buildKey(userId, key),
      JSON.stringify(record),
      'EX',
      IdempotencyService.TTL_SECONDS,
    );
  }
}
