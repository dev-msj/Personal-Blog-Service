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

writing-principles.md §"Test Pyramid 7종" 형식 준수. TC 개수는 도메인 flow(12개) §6 매핑 + 비-flow 인프라/cross-cutting TC(§9.5/§10/§11/§12)에서 도출. 자율 출발점 금지.

| 종류 | 입력 산출물 ID | TC 개수 | 비율 | 도출 근거 |
|------|---------------|---------|------|-----------|
| 단위 | application-arch.md 모듈 단위 + Invariant PBT + cross-cutting | 13 | 12% | 비밀번호 해싱 결정성(TC-02) / verifyRefreshToken throw(TC-20) / oauth audience mock(TC-25) / routing 깊이1(TC-80) / 키 미제공·헤더 형식(IDEM-02·07) / AuthGuard DT-2 분기(TC-94·95·96) + PBT 단위 4건(INV-6 TC-39, INV-7 단조성 TC-44, cursor round-trip TC-53, DT-1 state machine IDEM-08) |
| 통합 | application-arch.md 모듈 의존(repository ↔ DB, Service ↔ Redis) + 트랜잭션 경계 + 인덱스 사용 + 마이그레이션 가역성 | 17 | 16% | RefreshToken Rotation 트랜잭션(TC-08·19) / OAuth Account Linking race·nickname(TC-26·27) / 가입 트랜잭션(TC-03) / FK CASCADE(TC-72·81) / hits·like race(TC-41·57) / cursor 인덱스 EXPLAIN(TC-52·89) / N+1·페이징 일관성(TC-47·48) / IDOR 2차방어(TC-35) / DT-2 R5(TC-18) / Idempotency path 검증(IDEM-04) / 마이그레이션 down→up 가역성(TC-90) |
| 계약 | Idempotency 멱등 contract (security.md §8, DT-1) | 4 | 4% | Idempotency 멱등 contract — DT-1 R2 miss→cache(IDEM-01) / R3 hit-stored 재반환(IDEM-03) / R4 in-flight(IDEM-05) / 실패 응답 캐싱 재현(IDEM-06). idempotency-key-handle §6 종류 메타와 정합 |
| E2E | UC-1~9 Main + Extensions + flows §6 매핑 + health 회귀 | 58 | 56% | 12개 flow의 정상 흐름 + Alternate + Exception 전수 커버(flow 순수 E2E 57건) + health 격리 부트 회귀(TC-91, 비-flow) |
| 성능 | nfr-qas.md QAS-N | N/A — nfr-qas.md 비활성 (NFR 활성은 Phase 4) | N/A | 적용 조건 미충족 — Phase 4 위임 명시 |
| 보안 | threat-model.md STRIDE-1·4·6·7·9·10·11 + security.md §2.2/§5/§7 | 12 | 12% | IDOR 방어(Post TC-34 / PostLike TC-62 / Comment TC-68 / Reply TC-78) + Throttler 4 엔드포인트(TC-06·12·28·38) + 로그인 실패·잠금(TC-10·11) + 로그인 카운터 PBT(TC-92) + 시크릿/PII 미노출(TC-93). flow §6 "E2E(security)" 10건 + 비-flow 2건 |
| 카오스 | nfr-qas.md 가용성 QAS-N + runtime-behavior.md §7 | N/A — 적용 조건 0건 (nfr-qas.md 비활성 + Saga 없음 + 안전 중대 비해당) | N/A | runtime-behavior.md §7 미작성 정당화 인용. Phase 4 진입 시 NFR 활성 재점검 |

**합계: 104 TC** (단위 13 + 통합 17 + 계약 4 + E2E 58 + 보안 12). 성능/카오스 N/A.

내역: flow §6 매핑 97건(TC-01~89 + TC-IDEM-01~08) + 비-flow 인프라/cross-cutting 7건(TC-90 마이그레이션 가역성 통합, TC-91 health E2E, TC-92·93 보안, TC-94·95·96 AuthGuard 단위). TC-90~96 연속. 카운트는 §6.1 flow 인벤토리 + §9.5/§10/§11/§12 비-flow TC 종류 메타에서 도출(자율 출발점 금지). 각 TC는 단일 종류 — PBT/Specification by Example/Decision Table은 기법(§3·§4·§5)이며 종류와 직교한다(이중 귀속 없음).

비율 합리화: E2E 56%로 가장 큼 — Phase 1이 12개 flow × Main/Alternate/Exception 매핑이라 자연 도출. 통합 16%는 트랜잭션 원자성·동시성 race·인덱스·마이그레이션 가역성 등 DB 경계 검증에 집중. 계약 4%는 Idempotency 멱등이라는 Phase 1 유일의 명시 API 계약(DT-1)에 한정 — ResponseFormat/Cursor는 각 flow E2E가 응답 스키마를 직접 검증하므로 별도 계약 TC를 두지 않는다. PBT 단위 4건(INV-6/INV-7/cursor/DT-1 state)은 단위, 동시성·충돌 PBT(INV-7 race TC-41 / INV-8 TC-57 / nickname TC-27 / 로그인 카운터 TC-92)는 실 DB·Redis 의존이라 통합·보안으로 분류 — 모든 INV가 단위 PBT 적합한 것은 아니므로 의도적 분산.

## 3. Property-Based Testing [확정]

도구: **fast-check** (`fast-check` npm package). Phase 1 진입 시 의존성 추가.

### 3.1 Aggregate Invariant → Property

| Invariant | Property | TC |
|-----------|----------|-----|
| INV-6 (Post 본인만 수정/삭제) | 어떤 (postId, ownerId, attackerId)에 대해 ownerId ≠ attackerId 면 UPDATE/DELETE byIdAndOwner(postId, attackerId)는 affected rows = 0 | TC-39 |
| INV-7 (hits 단조 증가) | 어떤 GET 호출 시퀀스든 최종 hits = 호출 횟수, 중간 감소 없음 | TC-44 |
| INV-8 (PostLike (post_id, user_id) UNIQUE) | 어떤 (postId, userId) 쌍의 동시 INSERT 시퀀스에서도 like row count ≤ 1 | TC-57 |
| INV-2 (nickname UNIQUE) | nickname-derivation 알고리즘이 어떤 email 시퀀스에서도 UNIQUE 충돌 없는 nickname 생성 | TC-27 |

PBT는 기법이며 §2 Pyramid 종류와 직교한다 (이중 귀속 아님). 각 TC의 종류는 flow §6 메타 단일 기준: TC-39(INV-6, 단위), TC-44(INV-7 단조성, 단위), TC-53(cursor round-trip, 단위), IDEM-08(DT-1 state, 단위)은 순수 로직이라 단위. TC-41(INV-7 hits race, 통합), TC-57(INV-8 동시 INSERT, 통합), TC-27(nickname 충돌 retry, 통합)은 실 DB 의존이라 통합. TC-92(로그인 카운터, 보안)는 Redis 의존 보안.

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

비-flow TC 7건(§2 합계 104 = flow 97 + 7): 특정 flow에 매핑되지 않는 인프라/cross-cutting 회귀. TC-90(마이그레이션 가역성, 통합, §9.5), TC-91(health 격리 부트, E2E, §10), TC-92(로그인 카운터 RuleBasedStateMachine, 보안, §11), TC-93(password/refresh_token 미노출, 보안, §11), TC-94·95·96(AuthGuard DT-2 cross-cutting, 단위, §12). 비-flow는 TC-90~96 연속이며 flow 인벤토리(TC-01~89, TC-IDEM-01~08)와 합쳐 결번 없음. 각 TC의 종류는 해당 섹션이 단일 진실.

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

## 8. Provider 단위 테스트 컨벤션 (#61 확정) [확정]

DI에 참여하는 모든 Provider(생성자 의존을 `@Inject`/타입으로 주입받는 클래스 — Service, 필터, 파이프, 인터셉터 등)는 `Test.createTestingModule`로 SUT를 생성한다. `new X(dep as any)` 직접 인스턴스화는 금지한다.

근거: NestJS 권장 패턴이며, `@Inject` 토큰 배선을 단위 테스트에서 검증(DI 오설정을 E2E 이전에 포착)하고, `as any` 캐스팅을 제거(`no-explicit-any` 점진 제거 목표 정합)한다. 의존 1~2개 단순 Provider도 동일 규칙을 적용해 일관성을 우선한다.

예외 (주입받는 의존이 없는 클래스)는 모듈 없이 직접 호출/인스턴스화한다:
- DI에 참여하지 않는 순수 유틸 함수(`src/utils/*` 등)
- `@Inject` 의존 없이 옵션 객체만 생성자로 받는 클래스(예: `ValidationPipe` 옵션만 받는 `PathParamAwareValidationPipe`). NestJS도 전역 등록 시 `new X(options)`로 생성하므로 검증할 토큰 배선이 없다

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

### 8.2 단순 Provider (의존 1~2개)

필터/파이프 등 의존이 1~2개인 단순 Provider도 SUT 자체를 `Test.createTestingModule`로 생성하고 `module.get()`으로 꺼낸다. 의존은 inline 객체로 `useValue` 주입한다. `new XFilter(mockLogger as any)` 직접 인스턴스화는 사용하지 않는다 — DI 토큰 검증을 받고 `as any`를 제거하기 위함:

```typescript
const mockLogger = { error: jest.fn() } // 단순 의존은 inline 객체로 선언
const module: TestingModule = await Test.createTestingModule({
  providers: [
    BaseExceptionFilter,
    { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger }, // inline useValue 주입
  ],
}).compile()
filter = module.get(BaseExceptionFilter)
```

`@Catch`만 가진 필터처럼 `@Injectable`이 없어도 `@Inject` 파라미터 메타데이터로 providers 배열 등록 시 인스턴스화된다. 의존 자체가 단순 Provider인 경우(ConfigService 등)는 별도 mock 클래스 없이 inline 객체로 주입한다:

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

### 9.5 마이그레이션 가역성 회귀 (TC-90)

배경: globalSetup은 `runMigrations()`(up)만 실행하므로 데이터 보존형 마이그레이션의 `down()`은 작성만 되고 실행/검증되지 않는다 (PR #94 2차 심층리뷰 (5)(a), 2026-06-04 미팅 로그 결정 3). `down()`이 미검증 안전망으로 남으면 롤백 시 데이터 truncation/유실을 CI가 잡지 못한다.

- TC-90 [통합, 비-flow 인프라 회귀]: 데이터 보존형 마이그레이션 down→up 가역성. data-migration.md §단계 2·4·5(user_auth uid PK→user_id BIGINT, user_info 외래키, post/post_like 외래키)의 변환이 round-trip에서 데이터·제약을 보존하는지 검증
  - 절차: 신 스키마 시드 INSERT(user/user_auth/user_info/post 최소 세트) → 데이터 보존형 단계 `migration:revert`(down) → 동일 데이터 정합 확인 → `migration:run`(up) → 시드 데이터·FK·UNIQUE·PK 타입 보존 확인
  - 핵심 단언: uid VARCHAR ↔ user_id BIGINT round-trip에서 매핑 유실/중복 없음, login_id NULL(OAuth-only) 보존, BIGINT→VARCHAR rollback 시 truncation 없음
  - 위치: `test/integration/migration-reversibility.spec.ts` (data-source.ts DataSource 직접 사용, HTTP 없음)
  - 비-flow: 특정 UC/flow에 매핑되지 않는 마이그레이션 인프라 회귀. §6.1 flow 인벤토리(97) 외부의 인프라 TC로, AuthGuard cross-cutting(TC-94~96)·health 회귀(TC-91)와 동일 성격. §2 Pyramid 통합 카운트(26)에는 포함

근거: data-migration.md §단계 1~7(각 단계 down() 역방향 명세), §6.2 "down() 메소드에 역방향 로직 작성".

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
| TC-06 | join 시간당 5회 IP 초과 → COMMON_TOO_MANY_REQUESTS | STRIDE-10 | user-register Throttler |
| TC-10 | 비밀번호 불일치 → AUTH_INVALID_PASSWORD + login_fail INCR | STRIDE-1 | user-login §3.2 |
| TC-11 | 로그인 5회 실패 후 잠금 | STRIDE-1 | user-login §3.3 |
| TC-12 | login 분당 10회 IP 초과 | STRIDE-1, STRIDE-10 | user-login Throttler |
| TC-28 | oauth 분당 30회 IP 초과 → COMMON_TOO_MANY_REQUESTS | STRIDE-10 | user-oauth-login Throttler |
| TC-34 | Post IDOR (타인 UPDATE/DELETE) | STRIDE-4, STRIDE-11 | blog-post-write §3.2 |
| TC-38 | Throttler Write API 분당 60회 user_id | STRIDE-10 | blog-post-write |
| TC-62 | PostLike IDOR (DELETE WHERE 절) | STRIDE-4 | post-like-toggle §1.2 |
| TC-68 | Comment IDOR | STRIDE-4 | comment-write §3.3 |
| TC-78 | Reply IDOR | STRIDE-4 | reply-write §3.3 |
| TC-92 | 로그인 카운터 RuleBasedStateMachine (PBT) | STRIDE-1 | user-login (PBT, 비-flow) |
| TC-93 | password/refresh_token 응답 비노출 (PII) | STRIDE-7 | user-register / user-login (비-flow) |

총 12 보안 TC (flow §6 "E2E(security)" 10건 + 비-flow TC-92·93). 비율 12% (§2 Pyramid 정합).

## 12. AuthGuard cross-cutting TC

AuthGuard는 모든 보호 엔드포인트의 진입점이라 단일 flow에 매핑 안 됨. 별도 TC:

- TC-94 — DT-2 R1 (Access OK + Refresh OK + DB 일치) → 핸들러 진입 (단위)
- TC-95 — DT-2 R3 (Access NG + Refresh 쿠키 없음) → AuthUnauthorized (단위)
- TC-96 — sub BIGINT parseInt 실패 (runtime-deployment.md §1.1 분기 b) → AuthUnauthorized (단위)

이 TC들은 user-token-refresh 또는 user-login에 묶지 않고 별도 `auth-guard.spec.ts`에 위치. TC 인벤토리(§6.1)의 user-token-refresh TC-20에 verifyRefreshToken throw 통일 단위 테스트로 일부 흡수.

## 13. 마이그레이션 테스트 전략

적용 전략: Parallel Change (Expand-Migrate-Contract) — implementation-guide.md §마이그레이션 전략 정합.

기존 테스트 보존 정책:
- contract 단계(#128·#129·#130·#131)가 호출부를 user_id 기반으로 전환하기 전까지 기존 user-auth.e2e-spec.ts / post.e2e-spec.ts는 그린 유지를 보장한다. AuthHelper / DbCleaner의 uid→user_id 전환(§7.1)은 contract 단계 PR에서 동기 수행하여 동일 PR 내 그린 게이트를 닫는다
- migrate 단계는 스키마/데이터를 전환하되 Service 외부 계약(HTTP 응답 스키마)은 불변이므로 기존 E2E가 통과해야 한다. Repository는 contract 단계 전까지 기존 호출 시그니처 호환을 유지한다. 통과 불가 시 그 단계가 그린 게이트 하한 위반 — 분할 재검토

신구 등가성 테스트:
- TC-90(통합, 비-flow, §9.5): 데이터 보존형 마이그레이션 down→up 가역성. 단계 2·4·5의 uid VARCHAR ↔ user_id BIGINT round-trip에서 매핑 유실/중복 없음, login_id NULL(OAuth-only) 보존, BIGINT→VARCHAR rollback truncation 없음을 단언. 본 등가성 검증이 migrate 단계의 신구 데이터 등가성을 담보 (신규 TC 아님 — 기존 TC-90이 본 전략의 등가성 테스트 역할 수행)

어댑터 테스트:
- 본 전략은 영구 어댑터(신구 인터페이스 변환 계층)를 두지 않는다 (1회성 스키마 전이). AuthGuard sub BIGINT parseInt 변환이 JWT payload 신구 형식 사이의 임시 어댑터 역할이며, TC-96(AuthGuard sub parseInt 실패 → AuthUnauthorized)이 어댑터 경계 테스트에 해당

시리즈 단계별 그린 게이트:
- expand(#117): user 테이블 신설 후 기존 전체 스위트 그린 (additive)
- migrate(#118·#119·#121·#122): 각 migration 파일 단위로 globalSetup runMigrations 통과 + Repository 호환 유지로 해당 도메인 E2E 그린 + TC-90 가역성 통과
- migrate(#120): user_auth_provider 매핑 후 OAuth 흐름 E2E 그린
- contract(#128~#131): Service 재작성 PR에서 AuthHelper/DbCleaner 전환 동기 수행, user-auth/post E2E 전수 그린으로 게이트 마감

카운트 영향: 본 섹션은 §2 Pyramid 합계를 변경하지 않는다. TC-90이 등가성 테스트로 재사용되며 신규 TC를 추가하지 않는다.

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
