import * as fc from 'fast-check';
import { Test } from '@nestjs/testing';
import type * as Redis from 'ioredis';
import { IdempotencyService } from './idempotency.service';
import { REDIS_CLIENT } from '../redis/redis.providers';

/**
 * TC-IDEM-08 (flows/idempotency-key-handle.md §6, testing-strategy.md §3 PBT).
 *
 * Idempotency Key 상태 전이 [absent] → pending → completed 의 단방향 invariant를
 * RuleBasedStateMachine(fc.commands)으로 검증한다. Redis는 in-memory map으로 대체하여
 * 실 컨테이너 없이 IdempotencyService의 transition 메소드 계약만 검증한다 (guide §7.1).
 *
 * Invariant:
 * - setPending은 absent에서만 락 획득(true), pending/completed에서는 실패(false)
 * - setCompleted는 항상 completed로 만든다(단방향 — completed에서 pending으로 회귀 불가)
 * - get은 현재 상태와 정합한다
 */

// SET NX EX / SET EX / GET 만 구현한 최소 in-memory Redis 더블.
class InMemoryRedis {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  // ioredis set(key, value, 'EX', ttl) 시그니처 모사. EX/ttl은 in-memory에서 무시.
  async set(key: string, value: string, ..._opts: unknown[]): Promise<'OK'> {
    void _opts;
    this.store.set(key, value);
    return 'OK';
  }

  // SET_PENDING_SCRIPT(SET NX EX)의 in-memory 모사: 키 부재 시 1, 존재 시 0.
  async eval(
    _script: string,
    _numKeys: number,
    key: string,
    value: string,
  ): Promise<number> {
    if (this.store.has(key)) {
      return 0;
    }
    this.store.set(key, value);
    return 1;
  }
}

type ModelState = 'absent' | 'pending' | 'completed';

interface Model {
  state: ModelState;
}

const USER = 'user-1';
const KEY = 'key-1';
const METHOD = 'POST';
const PATH = '/posts';

async function buildService(): Promise<IdempotencyService> {
  const module = await Test.createTestingModule({
    providers: [
      IdempotencyService,
      {
        provide: REDIS_CLIENT,
        useValue: new InMemoryRedis() as unknown as Redis.Redis,
      },
    ],
  }).compile();
  return module.get(IdempotencyService);
}

class SetPendingCommand implements fc.AsyncCommand<Model, IdempotencyService> {
  check(): boolean {
    return true;
  }

  async run(model: Model, real: IdempotencyService): Promise<void> {
    const acquired = await real.setPending(USER, KEY, METHOD, PATH);

    if (model.state === 'absent') {
      // absent → 락 획득 성공, pending으로 전이
      expect(acquired).toBe(true);
      model.state = 'pending';
    } else {
      // pending/completed → 락 획득 실패, 상태 불변 (단방향 보장)
      expect(acquired).toBe(false);
    }
  }

  toString(): string {
    return 'setPending';
  }
}

class SetCompletedCommand
  implements fc.AsyncCommand<Model, IdempotencyService>
{
  check(): boolean {
    return true;
  }

  async run(model: Model, real: IdempotencyService): Promise<void> {
    await real.setCompleted(USER, KEY, METHOD, PATH, 200, { ok: true });
    // setCompleted는 항상 completed로 수렴 (단방향 — 회귀 없음)
    model.state = 'completed';

    const record = await real.get(USER, KEY);
    expect(record).not.toBeNull();
    expect(record?.state).toBe('completed');
  }

  toString(): string {
    return 'setCompleted';
  }
}

class GetCommand implements fc.AsyncCommand<Model, IdempotencyService> {
  check(): boolean {
    return true;
  }

  async run(model: Model, real: IdempotencyService): Promise<void> {
    const record = await real.get(USER, KEY);

    if (model.state === 'absent') {
      expect(record).toBeNull();
    } else {
      expect(record).not.toBeNull();
      expect(record?.state).toBe(model.state);
    }
  }

  toString(): string {
    return 'get';
  }
}

describe('TC-IDEM-08 Idempotency state transition (PBT)', () => {
  it('absent→pending→completed 단방향 전이 invariant를 만족한다', async () => {
    const commands = [
      fc.constant(new SetPendingCommand()),
      fc.constant(new SetCompletedCommand()),
      fc.constant(new GetCommand()),
    ];

    await fc.assert(
      fc.asyncProperty(fc.commands(commands, { size: '+1' }), async (cmds) => {
        const real = await buildService();
        const model: Model = { state: 'absent' };
        await fc.asyncModelRun(() => ({ model, real }), cmds);
      }),
      { numRuns: 100 },
    );
  });
});
