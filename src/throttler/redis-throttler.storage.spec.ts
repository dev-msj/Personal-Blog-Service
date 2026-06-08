import { RedisThrottlerStorage } from './redis-throttler.storage';

describe('RedisThrottlerStorage', () => {
  let storage: RedisThrottlerStorage;
  let mockEval: jest.Mock;

  beforeEach(() => {
    mockEval = jest.fn();
    // ioredis 인스턴스를 eval만 mock하여 주입 (단위 테스트는 TS 매핑 계층 검증.
    // Lua 원자성/윈도우 동작은 throttler.e2e-spec.ts에서 실 Redis로 검증)
    storage = new RedisThrottlerStorage({ eval: mockEval } as never);
  });

  it('counter/block 키와 ttl·limit·blockDuration을 eval 인자로 전달한다', async () => {
    mockEval.mockResolvedValue([1, 60000, 0, 0]);

    await storage.increment('tracker-key', 60000, 200, 60000);

    expect(mockEval).toHaveBeenCalledTimes(1);
    const args = mockEval.mock.calls[0];
    // args: [script, numKeys, counterKey, blockKey, ttl, limit, blockDuration]
    expect(args[1]).toBe(2);
    expect(args[2]).toBe('throttle:tracker-key');
    expect(args[3]).toBe('throttle:block:tracker-key');
    expect(args[4]).toBe(60000);
    expect(args[5]).toBe(200);
    expect(args[6]).toBe(60000);
  });

  it('Lua 반환(ms)을 ThrottlerStorageRecord(초)로 매핑한다 — 미차단', async () => {
    mockEval.mockResolvedValue([5, 30000, 0, 0]);

    const record = await storage.increment('k', 60000, 200, 60000);

    expect(record).toEqual({
      totalHits: 5,
      timeToExpire: 30,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('limit 초과 시 isBlocked=true + timeToBlockExpire(초)를 반환한다', async () => {
    mockEval.mockResolvedValue([201, 0, 1, 60000]);

    const record = await storage.increment('k', 60000, 200, 60000);

    expect(record.isBlocked).toBe(true);
    expect(record.timeToBlockExpire).toBe(60);
    expect(record.totalHits).toBe(201);
  });

  it('남은 ms는 올림(ceil)하여 초로 변환한다', async () => {
    mockEval.mockResolvedValue([1, 59999, 0, 0]);

    const record = await storage.increment('k', 60000, 200, 60000);

    expect(record.timeToExpire).toBe(60);
  });

  it('pttl이 0이면 timeToExpire는 0이다', async () => {
    mockEval.mockResolvedValue([10, 0, 0, 0]);

    const record = await storage.increment('k', 60000, 200, 60000);

    expect(record.timeToExpire).toBe(0);
  });
});
