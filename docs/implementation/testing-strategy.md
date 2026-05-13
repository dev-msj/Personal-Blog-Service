# Testing Strategy — Phase 1: 기능 완성 + 도메인 재정비

## 개요

Phase 1은 User Aggregate 재설계 + Comment/Reply 신설 + 커서 페이징 + Idempotency-Key + 보안 강화의 5개 영역을 다룬다. 단순 회귀 보호를 넘어 **신규 도메인 Invariant 정형 검증**(PBT), **DT-1/DT-2 분기 매핑 검증**, **IDOR 방어 검증**이 핵심.

기존 Phase 0 산출물(synchronize:false migrations, 단일 ioredis Provider, PathParamAwareValidationPipe) 위에서 신규 테스트가 동작. E2E는 globalSetup이 migration 자동 실행하므로 신규 마이그레이션 7건도 자동 적용.

## 1. 테스트 분류

| 종류 | 도구 | 위치 | 적용 조건 |
|------|------|------|----------|
| 단위 (Unit) | Jest + ts-jest, mocked Repository, fast-check (PBT) | `*.spec.ts` 소스 동일 위치 | 항상 |
| 통합 (Integration) | Jest + Test.createTestingModule + 실제 DB/Redis 부분 모듈 | `test/integration/*.spec.ts` 또는 모듈 내부 | 항상 |
| 계약 (Contract) | supertest API 호출 + Idempotency 멱등 검증 | `test/contract/*.spec.ts` | API/Idempotency 존재 |
| E2E | supertest + 실제 Docker (MySQL 3307 / Redis 6380) | `test/*.e2e-spec.ts` | 항상 |
| 성능 (Performance) | k6 | Phase 4 위임 | nfr-qas.md 활성 시 — Phase 4 |
| 보안 (Security) | E2E + supertest + threat-model.md STRIDE 매핑 | `test/security/*.e2e-spec.ts` 또는 통합 E2E 내부 | threat-model.md 활성 (Phase 1 활성) |
| 카오스 (Chaos) | N/A | — | 가용성 QAS ≥99.9% 또는 핵심 Saga 또는 안전 중대 — 본 프로젝트 N/A |

## 2. Test Pyramid 비율 (7종) [확정]

writing-principles.md §"Test Pyramid 7종" 형식 준수. TC 개수는 도메인 flow(12개)별 매핑에서 도출. 자율 출발점 금지.

| 종류 | 입력 산출물 ID | TC 개수 | 비율 | 도출 근거 |
|------|---------------|---------|------|-----------|
| 단위 | application-arch.md M-1~M-N 모듈 단위 + Invariant PBT | 15 | 15% | user-auth.service / post.service / comment.service / reply.service / cursor-utility / nickname-utility / crypto-utility 단위 검증 + Invariant PBT 6건 (INV-6, INV-7, INV-8, DT-1 state machine, cursor round-trip, nickname-derivation) |
| 통합 | application-arch.md 모듈 의존(repository ↔ DB, Service ↔ Redis) + 트랜잭션 경계 + 인덱스 사용 | 25 | 26% | RefreshToken Rotation 트랜잭션 / OAuth Account Linking 4테이블 트랜잭션 / FK CASCADE / 동시성 race / cursor 인덱스 EXPLAIN / Idempotency Redis race |
| 계약 | API 명세(Phase 1 신규 13 엔드포인트) + Idempotency 멱등 contract (security.md §8) | 8 | 8% | Idempotency 4분기 contract (TC-IDEM-01·03·05·06) + ResponseFormat contract (SuccessResponse/FailureResponse 일관성) + Cursor 응답 contract |
| E2E | UC-1~9 Main + Extensions + flows §6 매핑 | 40 | 41% | 12개 flow의 정상 흐름 + Alternate + Exception 전수 커버. 각 flow ~3개 핵심 E2E |
| 성능 | nfr-qas.md QAS-N | N/A — nfr-qas.md 비활성 (NFR 활성은 Phase 4) | N/A | 적용 조건 미충족 — Phase 4 위임 명시 |
| 보안 | threat-model.md STRIDE-1·4·6·7·9·10·11 + security.md §2.2/§5/§7 | 9 | 9% | IDOR 방어(Post/Comment/Reply 6 case) + Throttler 6 엔드포인트 (sample 3) + 로그인 잠금 시퀀스 + 시크릿 미노출 + STRIDE-4 IDOR cross-check |
| 카오스 | nfr-qas.md 가용성 QAS-N + runtime-behavior.md §7 | N/A — 적용 조건 0건 (nfr-qas.md 비활성 + Saga 없음 + 안전 중대 비해당) | N/A | runtime-behavior.md §7 미작성 정당화 인용. Phase 4 진입 시 NFR 활성 재점검 |

**합계: 97 TC** (단위 15 + 통합 25 + 계약 8 + E2E 40 + 보안 9). 성능/카오스 N/A.

**pyramid-tracking 카운트** (plan-manager 메타 라인):
```
unit:15, integration:25, contract:8, e2e:40, performance:n/a, security:9, chaos:n/a
```

비율 합리화: E2E 41%로 가장 큼 — Phase 1이 12개 flow × Main/Alternate/Exception 매핑이라 자연 도출. PBT 6건 포함한 단위 15%는 신규 INV 8건(INV-AP1, Cmt1, Cmt2, Rpl1, Rpl2, DT-1 state, cursor round-trip, nickname) 대비 적정 — 모든 INV가 PBT 적합한 것은 아니므로 의도적 선택.

## 3. Property-Based Testing [확정]

도구: **fast-check** (`fast-check` npm package). Phase 1 진입 시 의존성 추가.

### 3.1 Aggregate Invariant → Property

| Invariant | Property | TC |
|-----------|----------|-----|
| INV-6 (Post 본인만 수정/삭제) | 어떤 (postId, ownerId, attackerId)에 대해 ownerId ≠ attackerId 면 UPDATE/DELETE byIdAndOwner(postId, attackerId)는 affected rows = 0 | TC-39 |
| INV-7 (hits 단조 증가) | 어떤 GET 호출 시퀀스든 최종 hits = 호출 횟수, 중간 감소 없음 | TC-44 |
| INV-8 (PostLike (post_id, user_id) UNIQUE) | 어떤 (postId, userId) 쌍의 동시 INSERT 시퀀스에서도 like row count ≤ 1 | TC-57 |
| INV-2 (nickname UNIQUE) | nickname-derivation 알고리즘이 어떤 email 시퀀스에서도 UNIQUE 충돌 없는 nickname 생성 | TC-27 |

### 3.2 RuleBasedStateMachine

| 대상 | 전이 규칙 | TC |
|------|----------|-----|
| Idempotency Key state | absent → pending → completed (단방향, application-level 강제) | TC-IDEM-08 |
| 로그인 실패 카운터 | absent → 1 → ... → 5(locked) → TTL 만료 → absent. login 성공 시 즉시 absent | (security 카테고리 TC-92) |

fast-check `Command` API로 모델 구현. Redis 의존 부분은 mock 또는 ioredis-mock 사용.

### 3.3 Round-Trip Property

| 대상 | Property | TC |
|------|----------|-----|
| Cursor 인코딩 | 모든 (writeDatetime, postId)에 대해 decode(encode(x)) === x | TC-53 |
| AES PK 암호화 (기존 유지) | 모든 BIGINT id에 대해 decrypt(encrypt(id)) === id | (기존 테스트 유지) |

## 4. Specification by Example

UC Extensions의 Main/Alternate/Exception 분기를 Given/When/Then 형태로 명세. Jest `describe`/`it` 구조로 표현.

예시 (UC-1 회원가입):

```typescript
describe('UC-1 회원가입', () => {
  describe('Given login_id가 시스템에 미존재', () => {
    it('When POST /users/auth/join, Then UserAuth + UserInfo + User 생성됨', async () => { ... })
  })
  describe('Given 동일 login_id의 UserAuth 존재 (UC-1 2a)', () => {
    it('When POST /users/auth/join, Then USER_ALREADY_EXISTS 응답 + DB 불변', async () => { ... })
  })
  describe('Given Idempotency-Key 제공 + 캐시 hit-stored (DT-1 R3)', () => {
    it('When POST /users/auth/join, Then 핸들러 진입 없이 원본 응답 재반환', async () => { ... })
  })
})
```

대상: UC-1, UC-2, UC-3, UC-4, UC-5, UC-6, UC-7, UC-8, UC-9 모두 Main + Extensions 분기를 Given/When/Then으로 표현.

## 5. Decision Table 매핑

### 5.1 DT-1 (Idempotency-Key 처리) — UC-1·6·8·9 *a Extension 공통

| Rule | 조건 | TC |
|------|------|-----|
| R1 | 키 미제공 | TC-IDEM-02 |
| R2 | 키 + miss | TC-IDEM-01 |
| R3 | 키 + hit-stored | TC-IDEM-03 |
| R4 | 키 + hit-in-flight | TC-IDEM-05 |

각 domain flow의 `*a` Extension TC(TC-05, TC-37, TC-60, TC-69, TC-79)는 DT-1 R1·R2·R3·R4 매핑을 TC-IDEM-01~05 공유 적용.

### 5.2 DT-2 (토큰 이중 검증)

| Rule | 조건 | TC | flow |
|------|------|-----|------|
| R1 | Access OK + Refresh OK + DB 일치 (보호 통과) | (AuthGuard 단위 TC-94) | (AuthGuard cross-cutting) |
| R2 | Access OK + Refresh 쿠키 없음 | TC-15 | user-token-refresh §3.1 |
| R3 | Access NG + Refresh 쿠키 없음 | (AuthGuard 단위 TC-95) | (AuthGuard cross-cutting) |
| R4 | Refresh 서명/만료 NG | TC-16, TC-17 | user-token-refresh §3.2 |
| R5 | Refresh OK + DB 불일치 (탈취 의심) | TC-18 | user-token-refresh §3.3 |
| R6 | Refresh OK + DB 일치 (Rotation 갱신) | TC-13 | user-token-refresh §1 |

DT-2 R5 audit_log 알림 액션은 Phase 2 audit_log 도입 후 활성. Phase 1은 Winston 구조화 로그(`event: auth.token.invalid_refresh`)로 우선 기록.

## 6. Flow 분기 ↔ 테스트 매핑 [확정]

12개 flow의 §6 테스트 매핑과 양방향 정합. UC Extensions → flow 분기 → TC-N 트레이스 단일 진실 원천.

### 6.1 Flow별 TC 인벤토리

| flow | TC 범위 | 개수 |
|------|---------|------|
| user-register | TC-01 ~ TC-06 | 6 |
| user-login | TC-07 ~ TC-12 | 6 |
| user-token-refresh | TC-13 ~ TC-20 | 8 |
| user-oauth-login | TC-21 ~ TC-28 | 8 |
| blog-post-write | TC-29 ~ TC-39 | 11 |
| blog-post-read-detail | TC-40 ~ TC-44 | 5 |
| blog-post-list | TC-45 ~ TC-53 | 9 |
| post-like-toggle | TC-54 ~ TC-62 | 9 |
| comment-write | TC-63 ~ TC-72 | 10 |
| reply-write | TC-73 ~ TC-81 | 9 |
| comment-list-read | TC-82 ~ TC-89 | 8 |
| idempotency-key-handle | TC-IDEM-01 ~ TC-IDEM-08 | 8 |
| **합계** | — | **97** |

각 flow의 §6 표가 TC-N ↔ 노드/분기 ↔ 종류 매핑을 보유. 종류 메타(7종) 일관성은 본 §2 Pyramid 표와 cross-check.

### 6.2 UC Extensions ↔ flow 분기 ↔ TC 트레이스

대표 매핑 (전수는 각 flow §6 + UC-N 직접 매핑):

- UC-1 Main → user-register §1 → TC-01
- UC-1 Extension 2a → user-register §3.1 → TC-04
- UC-1 Extension *a (DT-1) → user-register §3.2 + idempotency-key-handle → TC-05 + TC-IDEM-01~05
- UC-4 Main → user-token-refresh §1 (DT-2 R6) → TC-13
- UC-4 Extensions 1a/2a/3a/5a → user-token-refresh §3.1~3.4 (DT-2 R2/R4/R5) → TC-15/16/17/18/19
- UC-5 Main → blog-post-read-detail §1 → TC-40
- UC-5 Extension 2a/3a → blog-post-read-detail §3.1/§3.2 → TC-42/43
- UC-6 추가 Main → post-like-toggle §1.1 → TC-54
- UC-6 취소 Main → post-like-toggle §1.2 → TC-55
- UC-6 추가-3a → post-like-toggle §3.1 → TC-56
- UC-7 Main → blog-post-list §1 → TC-45·46
- UC-7 Extensions 1a/2a → blog-post-list §3.1/§2.2 → TC-50/49
- UC-8 Main → comment-write §1 INSERT → TC-63
- UC-8 Extension 3a → comment-write §3.1 → TC-66
- UC-9 Main → reply-write §1 INSERT → TC-73
- UC-9 Extension 3a → reply-write §3.1 → TC-76

매핑 누락 시 mcpsi-implementation-verify 검증 4 (흐름 매핑 정합) fail.

## 7. 픽스처 구조

### 7.1 E2E 픽스처 (test/utils/)

기존 구조 유지 + Phase 1 영향:

- `DbCleaner`: Phase 1 신규 테이블 추가 — `Tables.REPLY`, `Tables.COMMENT`, `Tables.USER`, `Tables.USER_AUTH_PROVIDER`. cleanTables 호출 순서 (FK 역순):
  ```
  REPLY → COMMENT → POST_LIKE → POST → USER_INFO → USER_AUTH → USER_AUTH_PROVIDER → USER
  ```
- `AuthHelper`: JWT sub 발급을 user_id BIGINT 기반으로 재작성. 기존 uid VARCHAR 헬퍼는 마이그레이션 단계 종료 후 제거
- `UserFactory` (신규): `createUser(opts?)` — User + UserAuth (login_id, password 해시) + UserInfo (nickname) 일괄 생성, user_id 반환
- `OAuthUserFactory` (신규): User + UserAuthProvider + UserInfo, login_id NULL
- `PostFactory` (신규 또는 기존 보강): Post + 옵션 좋아요 N건
- `CommentFactory` / `ReplyFactory` (신규)

### 7.2 통합 테스트 픽스처

- `IntegrationTestModule`: TypeORM 실제 연결 + Repository만 inject. Service는 단위 spec과 분리
- Redis mock 옵션: `ioredis-mock` 또는 실제 docker-compose.test.yaml Redis 사용. Phase 1 Idempotency / 로그인 카운터 통합 테스트는 실제 Redis 사용 권고 (race condition 검증)

### 7.3 PBT 픽스처

- fast-check `fc.bigInt` / `fc.string` / `fc.commands` 활용
- Repository 의존 PBT는 `ioredis-mock` + sqlite in-memory 또는 실 컨테이너 한정

## 8. Provider 단위 테스트 컨벤션 (#61 흡수)

`Test.createTestingModule` + mocked repository 패턴 명문화.

### 8.1 표준 패턴

```typescript
describe('PostService', () => {
  let service: PostService
  const mockPostRepository: jest.Mocked<PostRepository> = {
    findById: jest.fn(),
    insertOwned: jest.fn(),
    updateByIdAndOwner: jest.fn(),
    deleteByIdAndOwner: jest.fn(),
    incrementHits: jest.fn(),
    findByCursor: jest.fn(),
    existsById: jest.fn(),
  }
  const mockPostLikeRepository: jest.Mocked<PostLikeRepository> = { ... }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        { provide: PostRepository, useValue: mockPostRepository },
        { provide: PostLikeRepository, useValue: mockPostLikeRepository },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile()
    service = module.get(PostService)
  })

  afterEach(() => jest.clearAllMocks())
})
```

### 8.2 단순 Provider (#61 원본 의도)

ConfigService, ValidationPipe 등 외부 의존 단순 Provider는 inline 객체로 useValue 주입. 별도 mock 클래스 작성 회피:

```typescript
const mockConfigService = { get: jest.fn((key) => mockEnv[key]) } as unknown as ConfigService
```

### 8.3 QueryRunner 트랜잭션 테스트

```typescript
const mockQR = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: { ... },
} as unknown as QueryRunner

const mockDataSource = {
  createQueryRunner: jest.fn(() => mockQR),
} as unknown as DataSource
```

트랜잭션 분기(commit / rollback) 모두 검증 (UserAuthService.refresh의 Rotation 원자성, OAuth Account Linking 4테이블 트랜잭션 등).

### 8.4 위치 컨벤션

소스와 동일 디렉토리:
```
src/user/service/user-auth.service.ts
src/user/service/user-auth.service.spec.ts
```

E2E는 `test/*.e2e-spec.ts`. 통합은 `test/integration/*.spec.ts` 또는 모듈 디렉토리 내부.

## 9. 신규 도입 가이드

### 9.1 fast-check 추가

```bash
npm install --save-dev fast-check
```

`jest.config.js` 변경 불필요 (fast-check은 Jest와 자연 통합).

### 9.2 ioredis-mock 추가 (선택)

PBT/단위 테스트에서 Redis mock 필요 시:
```bash
npm install --save-dev ioredis-mock
```

다만 통합/E2E는 실제 docker-compose.test.yaml Redis 사용 권고 (race condition 정합성).

### 9.3 globalSetup migration (Phase 0 기존)

`test/global-setup.ts`가 `dataSource.runMigrations()` 자동 실행. Phase 1 신규 migration 7건도 자동 적용. DbCleaner는 데이터 정리만 담당.

### 9.4 E2E 실행

```bash
docker-compose -f docker-compose.test.yaml up -d
npm run test:e2e
```

`maxWorkers: 1`, `testTimeout: 30000`, `forceExit: true` (jest-e2e.json 유지).

## 10. 회귀 보호 — Phase 0 산출물

Phase 1 작업 중 Phase 0 산출물 회귀 방지:

- #79 migrations 활성화 — Phase 1 신규 migration 7건이 기존 InitialSchema 위에 누적. baseline INSERT 또는 fresh start 절차 검증
- #86 단일 ioredis Provider — IdempotencyService / LoginFailCounter / Throttler storage 모두 REDIS_CLIENT inject 사용. CacheModule 별도 client 분기 없음
- #77 HealthModule 자기완결성 — Phase 1 신규 모듈 추가 시에도 health.e2e-spec.ts 격리 부트 통과
- #89 PathParamAwareValidationPipe — Phase 1 모든 PK 복호화 엔드포인트 path 우회 보장 회귀

각 회귀 보호 TC:
- TC-32 (blog-post-write §3.5) — #89 회귀
- TC-91 (E2E) — health.e2e-spec.ts 통과 (Phase 0 baseline 유지)

## 11. 보안 카테고리 TC 세부

threat-model.md STRIDE-N + security.md §Threat Mitigation 매트릭스 매핑:

| TC | 대상 | STRIDE | flow |
|----|------|--------|------|
| TC-11 | 로그인 5회 실패 후 잠금 | STRIDE-1 | user-login §3.3 |
| TC-12 | login 분당 10회 IP 초과 | STRIDE-1, STRIDE-10 | user-login §Throttler |
| TC-34 | Post IDOR (타인 UPDATE/DELETE) | STRIDE-4, STRIDE-11 | blog-post-write §3.2 |
| TC-62 | PostLike IDOR (DELETE WHERE 절) | STRIDE-4 | post-like-toggle §1.2 |
| TC-68 | Comment IDOR | STRIDE-4 | comment-write §3.3 |
| TC-78 | Reply IDOR | STRIDE-4 | reply-write §3.3 |
| TC-92 | 로그인 카운터 RuleBasedStateMachine (PBT) | STRIDE-1 | user-login (PBT) |
| TC-93 | password/refresh_token 응답 비노출 (PII) | STRIDE-7 | user-register / user-login |
| TC-38 | Throttler Write API 분당 60회 user_id | STRIDE-10 | blog-post-write |

총 9 보안 TC. 비율 9% (§2 Pyramid 정합).

## 12. AuthGuard cross-cutting TC

AuthGuard는 모든 보호 엔드포인트의 진입점이라 단일 flow에 매핑 안 됨. 별도 TC:

- TC-94 — DT-2 R1 (Access OK + Refresh OK + DB 일치) → 핸들러 진입 (단위)
- TC-95 — DT-2 R3 (Access NG + Refresh 쿠키 없음) → AuthUnauthorized (단위)
- TC-96 — sub BIGINT parseInt 실패 (runtime-deployment.md §1.1 분기 b) → AuthUnauthorized (단위)

이 TC들은 user-token-refresh 또는 user-login에 묶지 않고 별도 `auth-guard.spec.ts`에 위치. TC 인벤토리(§6.1)의 user-token-refresh TC-20에 verifyRefreshToken throw 통일 단위 테스트로 일부 흡수.

## Sources

- docs/solution/phase-1/{scope,arch-increment,data-migration,async-deployment,security-deployment,runtime-deployment}.md
- docs/solution/common/{security,async,runtime-behavior,application-arch,data-design}.md
- docs/problem/{use-cases,domain-spec,threat-model}.md
- docs/implementation/flows/*.md (12개, §6 테스트 매핑 양방향 정합)
- docs/implementation/implementation-guide.md
- 방법론:
  - ISO/IEC/IEEE 29119-4 (테스트 기법 분류)
  - ISTQB Foundation §4 Test Techniques (Decision Table §4.2.3)
  - fast-check (Property-Based Testing, RuleBasedStateMachine)
  - Cockburn "Writing Effective Use Cases" (Specification by Example 매핑)
  - OWASP Top 10 2021 (보안 카테고리 매핑)
- GitHub Issue #61 (Provider 단위 테스트 패턴 — Phase 1 흡수)
