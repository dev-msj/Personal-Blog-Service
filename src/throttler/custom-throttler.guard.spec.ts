import { Test, TestingModule } from '@nestjs/testing';
import { getOptionsToken, getStorageToken } from '@nestjs/throttler';
import { CustomThrottlerGuard } from './custom-throttler.guard';

describe('CustomThrottlerGuard', () => {
  let guard: CustomThrottlerGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomThrottlerGuard,
        {
          provide: getOptionsToken(),
          useValue: {
            throttlers: [{ name: 'default', ttl: 60000, limit: 200 }],
          },
        },
        { provide: getStorageToken(), useValue: { increment: jest.fn() } },
      ],
    }).compile();

    guard = module.get(CustomThrottlerGuard);
  });

  // getTracker는 protected이므로 시그니처 접근 위해 캐스팅 (DI 우회 아님)
  const callGetTracker = (req: Record<string, unknown>): Promise<string> =>
    (
      guard as unknown as { getTracker(r: unknown): Promise<string> }
    ).getTracker(req);

  it('인증된 요청은 authenticatedUser 기반 user:<uid> 트래커를 반환한다', async () => {
    const req = { headers: { authenticatedUser: 'uid-123' }, ip: '10.0.0.1' };

    await expect(callGetTracker(req)).resolves.toBe('user:uid-123');
  });

  it('미인증 요청은 ip:<ip> 트래커를 반환한다', async () => {
    const req = { headers: {}, ip: '10.0.0.1' };

    await expect(callGetTracker(req)).resolves.toBe('ip:10.0.0.1');
  });

  it('headers가 없어도 ip 트래커로 폴백한다', async () => {
    const req = { ip: '192.168.0.5' };

    await expect(callGetTracker(req)).resolves.toBe('ip:192.168.0.5');
  });
});
