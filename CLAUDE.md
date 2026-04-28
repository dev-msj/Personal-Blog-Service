# CLAUDE.md

Claude Code가 이 저장소에서 작업할 때 참조하는 프로젝트 규칙.

## MCPSI 문서 (authoritative)

설계/결정의 단일 출처. 코드와 불일치 시 MCPSI 문서가 우선이며, CLAUDE.md는 현 구현 기준으로 기술한다.

- docs/context.md — 비즈니스 맥락, 기술 제약, Ubiquitous Language, 알려진 불확실성
- docs/problem.md — BP1~BP6, TP1~TP8, UC, Invariant, Phase 근거
- docs/solution/overview.md — 단일 BC, 기술 스택 확정, Extension 적용 계획
- docs/solution/application-arch.md — 모듈 구조(현/Phase 1 이후), Aggregate, 채택 패턴, 3방향 리팩토링
- docs/solution/data-design.md — 스키마/DDL/ER, Phase별 스키마 진화, 트랜잭션
- docs/solution/async-processing.md — 이벤트 계약, 브로커(BullMQ+Kafka), Outbox, Idempotency, DLQ
- docs/solution/security.md — 인증/인가, 시크릿, 데이터 보호, Rate Limiting, API Idempotency-Key
- docs/solution/observability.md — 로그/메트릭/트레이싱, Correlation ID, 감사 로그(audit_log), LGTM 스택
- docs/implementation/issue-plan.md — 현재 Phase의 이슈 분해와 의존 관계
- docs/tech-notes/ — 파생 기술 블로그 산출물

## Phase 로드맵 (요약, 상세는 MCPSI)

각 Phase의 의도 + 주요 항목. 부정형 경계(범위 외 / 인접 Phase 위임)의 1차 진실은 docs/problem.md §Phase 근거.

- Phase 0 기반 확보 — *비동기화/관측성 진입 + Phase 1 대규모 스키마 변경 진입 게이트. PR 사이클 발견 결함 흡수 영역.* Node 22.x LTS 선언, 미사용 redis 의존성 제거, TypeORM migrations 활성화(synchronize:false), gitleaks pre-commit, E2E HealthModule CACHE_MANAGER 수정
- Phase 1 기능 완성 + 도메인 재정비 — *기능 완성의 첫 마일스톤(Phase 1~3 누적이 곧 기능 완성).* User Aggregate 재설계(userId BIGINT 분리, UserAuthProvider 신설), 댓글/답글, 커서 페이징, Idempotency-Key, @nestjs/throttler, 로그인 실패 카운트
- Phase 2 관측성 — *측정 사이클(Phase 4)의 전제 인프라. 측정 자체는 Phase 4.* observability 모듈 신설(audit/, Correlation ID Interceptor + AsyncLocalStorage, Winston 포맷 확장, prom-client, OpenTelemetry), LGTM 스택, audit_log 테이블
- Phase 3 비동기화 — ***기능적 구현의 마지막 단계. Phase 3 종료 시 Phase 4가 측정할 시스템 형상 확정. 이후 Phase 4·5는 새 기능 도입 봉인.*** BullMQ(작업 큐) + Kafka(이벤트 스트리밍) + Transactional Outbox + notification 모듈, hits/좋아요 집계 비동기 전환
- Phase 4 부하 테스트 1차 — ***Phase 5 재측정과의 before/after 비교 기준점. 측정 중 코드 변경 금지.*** k6, Baseline+Load+Stress, Prometheus Remote Write → Grafana
- Phase 5 품질 개선 + 재측정 — ***Phase 4 baseline 대비 동일 시나리오 재측정 비교를 위한 프로덕션 품질 개선*** (단순 버전 업데이트 아님). **Phase 0 영역(Node 버전, migrations 활성화, 의존성 정리, 기반 결함 흡수)을 본 Phase로 이관 금지**. argon2id, AES-GCM, NestJS 11 + @nestjs/swagger 11 + TS 6 + Jest 30, RFC 9457 Problem Details 전환, Phase 4와 동일 시나리오 재측정

현재 상태: Phase 0 진행 가능(이슈 #75~#79, #85~#86, #89 분해 완료). Phase 1 이후는 계획이며 코드에는 아직 반영되지 않음.

## Build & Development Commands

```bash
npm run start:dev          # watch 모드 개발 실행
npm run start:debug        # 디버거 활성 실행
npm run build              # TypeScript 컴파일 → dist/
npm run start:prod         # dist/main.js 실행

npm run lint               # ESLint auto-fix
npm run format             # Prettier

npm run test               # 단위 테스트
npm run test:watch
npm run test:cov
npm run test:e2e

# 단일 테스트 파일
npx jest path/to/file.spec.ts
npx jest --testPathPattern="post.service"
```

## 아키텍처 개요

- Framework: NestJS 10 + TypeScript (strictNullChecks, noImplicitAny, target ES2021)
- DB/캐시: MySQL 8.0 + Redis (Docker Compose)
- ORM: TypeORM (쿼리 캐시 활성, 테스트 환경은 비활성 분기)
- 테스트: Jest (unit) + supertest (E2E, 실제 컨테이너)
- 검증: Joi (환경변수), class-validator (DTO)
- 인증: jsonwebtoken 직접 구현 (passport 미사용)
- 로깅: nest-winston + winston-daily-rotate-file
- 암호화: crypto-js (AES-ECB, Phase 5에 AES-GCM 전환 예정)
- OAuth: google-auth-library (Google)

### 모듈 구조 (현 상태)

```text
src/
├── auth/           # AuthGuard (전역 인증 가드)
├── blog/           # Post, PostLike
├── user/           # UserAuth, UserInfo, JWT, OAuth
├── health/         # @nestjs/terminus 기반 health check (RedisModule을 직접 import하여 REDIS_CLIENT inject)
├── redis/          # 단일 ioredis 인스턴스 Provider (REDIS_CLIENT 토큰 + OnModuleDestroy로 quit())
├── config/         # TypeORM, Redis, Winston, JWT, env validation (Joi)
├── constant/       # ErrorCode enum, UserRole enum
├── decorator/      # @Public(), @Roles(), @AuthenticatedUserValidation(), @EncryptField()
├── filter/         # BaseException / HttpException / Unhandled ExceptionFilter
├── interceptor/    # EncryptPrimaryKeyInterceptor
├── pipe/           # DecryptPrimaryKeyPipe, PathParamAwareValidationPipe
├── exception/      # 도메인별 Custom Exception (auth/, user/, blog/, validation/)
├── response/       # BaseResponseDto, SuccessResponse, FailureResponse
├── types/          # 공용 타입 선언
└── utils/          # crypto, pagination (TAKE=20), cache key, time
```

Phase 1 이후에 observability/ (Phase 2) 및 notification/ (Phase 3) 모듈이 신설된다. application-arch.md §Phase 1 이후 구조 참조.

### Feature 모듈 내부 구조

```text
blog/: controller/ dao/ dto/ dto/interface/ entities/ repository/ service/
user/: controller/ dao/ dto/ dto/interface/ entities/ interceptor/ repository/ service/
```

### Layered Architecture

Controller → Service → Repository → Entity

- Controllers: HTTP 처리 + Swagger 문서
- Services: 비즈니스 로직
- Repositories: TypeORM 쿼리
- DAOs: Entity → DTO 변환
- DTOs: class-validator 검증
- Pipes: DecryptPrimaryKeyPipe (암호화된 path param 복호화, 실패 시 InvalidEncryptedParameterException), PathParamAwareValidationPipe (전역 ValidationPipe 서브클래스, path 파라미터 transformPrimitive 우회)
- Interceptors: EncryptPrimaryKeyInterceptor (@EncryptField() 필드 자동 암호화), SetRefreshTokenCookieInterceptor (user 모듈, JwtDto 응답 시 refreshToken 쿠키 자동 설정)

### App Configuration (setupApp)

- CORS: `enableCors({ origin: true, credentials: true })` — 학습 환경, 프로덕션 배포 트리거 시 allowlist 전환 예정
- ValidationPipe 전역: `PathParamAwareValidationPipe` (ValidationPipe 서브클래스, `whitelist: true, transform: true, enableImplicitConversion: true`). path 파라미터(`metadata.type === 'param'`)는 우회하여 사용자 파이프(`DecryptPrimaryKeyPipe`, `ParseIntPipe` 등)가 원문을 받도록 보장. body/query/custom은 super 위임
- cookieParser 미들웨어
- 전역 Guard: APP_GUARD → AuthGuard (app.module.ts)
- 전역 Filter: APP_FILTER → BaseExceptionFilter, HttpExceptionFilter, UnhandledExceptionFilter
- Shutdown 훅: main.ts에서 `app.enableShutdownHooks()` 호출. SIGTERM/SIGINT 수신 시 RedisModule의 `OnModuleDestroy`(client.quit())가 트리거되어 ioredis 연결을 graceful 종료

## HTTP Response Convention

항상 HTTP 200 반환, body 내 에러 코드 (자체 컨벤션, RFC 9457 Problem Details는 Phase 5 전환 예정):

- 성공: `SuccessResponse { code, message, data }`
- 실패: `FailureResponse { code, message }`
- 타입별 Exception Filter가 모든 예외를 HTTP 200 + FailureResponse로 변환

ErrorCode 5자리 도메인별 체계 (src/constant/ErrorCode.enum.ts):

- Auth 10xxx: AUTH_UNAUTHORIZED, AUTH_INVALID_PASSWORD, AUTH_INVALID_OAUTH_TOKEN, AUTH_REFRESH_TOKEN_REQUIRED, AUTH_INVALID_REFRESH_TOKEN
- User 20xxx: USER_NOT_FOUND, USER_ALREADY_EXISTS, USER_INFO_NOT_FOUND, USER_INFO_ALREADY_EXISTS
- Post 30xxx: POST_NOT_FOUND
- PostLike 31xxx: POST_LIKE_ALREADY_EXISTS, POST_LIKE_NOT_FOUND
- Common 90xxx: COMMON_BAD_REQUEST, COMMON_UNAUTHORIZED, COMMON_NOT_FOUND, COMMON_NOT_ACCEPTABLE, COMMON_CONFLICT, COMMON_INTERNAL_ERROR, COMMON_SERVICE_UNAVAILABLE
- Validation 91xxx: INVALID_ENCRYPTED_PARAMETER, INVALID_PAGE

Phase 1에서 COMMON_TOO_MANY_REQUESTS(90xxx) 추가 예정 (Rate Limit 429 대응).

## 인증 흐름

JWT access/refresh 이중 검증:

1. 전역 AuthGuard가 모든 요청 가드 (`@Public()` 제외)
2. Authorization: Bearer 헤더의 accessToken 서명/만료 검증
3. HTTPOnly 쿠키의 refreshToken을 DB 저장값과 대조 (서버측 세션 검증)
4. 두 토큰 모두 유효해야 통과 — 즉시 세션 무효화 가능
5. access 만료 시 클라이언트가 `POST /users/auth/refresh` 호출로 갱신
6. Refresh Token Rotation: refresh 시 access + refresh 모두 재발급, DB 저장값 원자적 갱신 (QueryRunner 트랜잭션)
7. SetRefreshTokenCookieInterceptor: 응답에 JwtDto 포함 시 refreshToken HTTPOnly 쿠키 자동 설정

배경: docs/tech-notes/token-validation-strategies.md (Phase 0 Type A 블로그).

### Google OAuth

- `POST /users/auth/oauth` — Google ID Token 검증 후 자동 회원가입/로그인
- 검증: google-auth-library, `GOOGLE_CLIENT_ID` 환경변수 필요
- 현 구현은 payload.email을 uid로 사용 (일반 가입과 동일인 식별 불가). Phase 1 TP5에서 UserAuthProvider 분리 + provider_subject(OAuth sub)로 재설계 예정

### 주요 데코레이터

- `@Public()` — 인증 우회 (join/login/refresh/oauth 4개)
- `@Roles(UserRole.USER)` — 역할 기반 접근
- `@AuthenticatedUserValidation()` — 인증된 사용자 ID 주입

## Database Entities

- UserAuthEntity (USER_AUTH): uid, password, salt, refreshToken, userRole, socialYN — 타임스탬프 포함
- UserInfoEntity (USER_INFO): uid, nickname (UNIQUE), introduce — 타임스탬프 포함
- PostEntity (POST): postId (AUTO_INCREMENT), postUid, title, contents, hits, writeDatetime, 타임스탬프
- PostLikeEntity (POST_LIKE): 복합 PK (postId + uid)

Phase 1에서 user/user_auth/user_auth_provider/user_info/comment/reply 구조로 전면 재설계 예정 (data-design.md §Phase 1).

Primary Key는 API 응답에서 AES 암호화 (PK_SECRET_KEY):

- 요청: DecryptPrimaryKeyPipe가 path param 복호화 (Controller 진입 전)
- 응답: EncryptPrimaryKeyInterceptor가 @EncryptField() DTO 필드 암호화 (Controller 반환 후)
- Service/DAO 레이어는 평문 number/string만 사용

UserSessionEntity: TypeORM 엔티티 아님. RefreshToken 검증 결과 인메모리 값 객체.

## Key Patterns

### N+1 쿼리 방어

`getPostLikeMapByPostIds()` 배치 로딩. 새 리스트 조회 경로도 동일 패턴 적용.

### 페이징

현재 offset 페이징 (`PaginationDto`, TAKE=20 고정). Phase 1에서 (writeDatetime DESC, postId DESC) 복합 키 커서 페이징으로 전환 예정 (TP4).

### 에러 처리

타입별 Exception Filter 계층 (AbstractExceptionFilter 공통 상속):

- BaseExceptionFilter: BaseException → errorCode 응답
- HttpExceptionFilter: NestJS 표준 HttpException
- UnhandledExceptionFilter: catch-all, 500 변환 + 원본 에러 로깅

BaseException 계층 (abstract, protected constructor) → 도메인별 하위 디렉토리:

- auth/: AuthUnauthorizedException, AuthInvalidPasswordException, AuthInvalidOauthTokenException, AuthRefreshTokenRequiredException, AuthInvalidRefreshTokenException
- user/: UserNotFoundException, UserAlreadyExistsException, UserInfoNotFoundException, UserInfoAlreadyExistsException
- blog/: PostNotFoundException, PostLikeAlreadyExistsException, PostLikeNotFoundException
- validation/: InvalidPageException, InvalidEncryptedParameterException
- 범용: UnexpectedCodeException (fallback)

새 예외 추가 시: ErrorCode enum 도메인 그룹에 맞는 하위 디렉토리에 클래스 생성 + barrel index.ts export.

### 로깅

nest-winston + winston-daily-rotate-file:

- 프로덕션: error 레벨 일별 로테이션
- 개발: info 레벨
- 디렉토리: logs/error/, logs/info/, 30일 보관, zip 압축
- 테스트: 파일 로거 비활성 (Jest 종료 문제 방지)

Phase 2에서 구조화 JSON 포맷(observability.md §1.1) + Correlation ID 자동 주입 + PII 마스킹 도입 예정.

## 환경 설정

```bash
docker-compose up -d                                    # 개발 (MySQL 3306, Redis 6379)
docker-compose -f docker-compose.test.yaml up -d        # 테스트 (MySQL 3307, Redis 6380, healthcheck)

env/.development.env
env/.test.env
```

### 필수 환경변수

- DB: DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE, DB_SYNCHRONIZE
- Redis: REDIS_HOST, REDIS_PORT, REDIS_TTL
- JWT: JWT_SECRET, JWT_ISSUER, JWT_ACCESSTOKEN_EXPIRE_TIME (기본 1h), JWT_REFRESHTOKEN_EXPIRE_TIME (기본 30d)
- Cookie: COOKIE_MAX_AGE (기본 30일 ms), COOKIE_SECURE (production 자동), COOKIE_SAME_SITE (기본 strict)
- Encryption: PK_SECRET_KEY (16자 고정, Phase 5에 32자 AES-256으로 확장 예정)
- OAuth: GOOGLE_CLIENT_ID

Phase 0에서 Node 22.x LTS 관련 버전 선언 파일 추가 (.nvmrc, package.json engines, .github/workflows setup-node). Phase 2에서 Slack Webhook 환경변수 3종(SLACK_WEBHOOK_PAGE_URL/TICKET_URL/SECURITY_URL) 추가 예정.

### Docker Compose 환경 차이

개발 vs 테스트:

- MySQL 포트 3306 vs 3307
- Redis 포트 6379 vs 6380
- healthcheck 없음 vs MySQL healthcheck 있음
- 데이터 경로 data/mysql, data/redis vs data/mysql-test, data/redis-test

TypeORM: 테스트 환경에서 Redis 쿼리 캐시 비활성 (isTestEnv 분기).

## Git Hooks (Husky + lint-staged)

- pre-commit: `npx lint-staged` — .ts 파일에 eslint --fix + prettier --write
- pre-commit: `gitleaks git --staged --pre-commit --redact` — staged 파일 시크릿 검사 (gitleaks 바이너리 필요: Windows `choco install gitleaks`, Mac `brew install gitleaks`, Linux `apt-get install gitleaks`)
- pre-push: `npm run build` — 빌드 검증

## TypeScript / Lint 설정

- strictNullChecks: true
- noImplicitAny: true
- target: ES2021
- ESLint: @typescript-eslint/no-explicit-any는 warn (점진적 제거), explicit-function-return-type off
- Prettier: endOfLine auto (Windows CRLF/LF 혼용 허용)

## 테스트 패턴

### 단위 테스트

NestJS `Test.createTestingModule` + mocked repository.

```typescript
const module: TestingModule = await Test.createTestingModule({
  providers: [
    PostService,
    { provide: PostRepository, useValue: mockPostRepository },
    { provide: ConfigService, useValue: mockConfigService },
  ],
}).compile();
```

소스와 동일 위치: `*.service.spec.ts`, `*.utils.spec.ts`.

### E2E 테스트

실제 Docker 컨테이너 사용:

```bash
docker-compose -f docker-compose.test.yaml up -d
npm run test:e2e
```

jest-e2e.json:

- maxWorkers: 1 (DB 충돌 방지)
- testTimeout: 30000
- forceExit: true
- setup.ts: dotenv 로드 + `NODE_ENV=test`

test/utils/:

- DbCleaner: `cleanTables()`, `cleanCache()`
- AuthHelper: JWT 토큰 생성

```typescript
beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleFixture.createNestApplication();
  configureApp(app);
  await app.initialize();
});

beforeEach(async () => {
  await dbCleaner.cleanTables([Tables.POST_LIKE, Tables.POST, Tables.USER_INFO, Tables.USER_AUTH]);
  await dbCleaner.cleanCache();
});

afterAll(async () => { await app.close(); });
```

E2E 파일: `test/*.e2e-spec.ts`. 현재 user-auth/post/app/health 4개. health.e2e-spec.ts는 HealthModule 자기완결성을 검증하는 격리 부트 (#77 / #67 / #86 해결). HealthModule이 `RedisModule`을 직접 import하여 `REDIS_CLIENT`를 inject 받으며 AppModule 전역 등록 또는 다른 spec의 `.overrideModule(CacheModule)`에 영향을 받지 않는다. app.e2e-spec.ts는 AppModule 전체 부트 + CacheModule override 환경에서도 `/health`가 동일하게 동작함을 통합 회귀 검증한다.

Phase 0 #79 완료 후 test/global-setup.ts에서 migration 자동 실행 통합 예정.

## Git 규칙

### 브랜치

- 전략: GitHub Flow
- 네이밍: `<타입>/<이슈번호>-<설명>`
  - 예: `feature/12-social-login`, `bugfix/45-login-validation`
- 타입: feature, bugfix, hotfix, refactor, docs

### 머지

- Squash Merge
- 머지 후 원격/로컬 브랜치 삭제

구현 절차는 글로벌 Phase B를 따른다.

## GitHub Actions

`.github/workflows/main.yml`:

- 트리거: `create` (브랜치 생성)
- 동작: 브랜치명에서 이슈 번호 추출 → Projects V2에서 해당 이슈를 "In Progress"로 이동
- 필요 secret: PROJECT_TOKEN

Phase 0 #75에서 setup-node step 추가 예정.

## API Documentation

로컬 Swagger UI: http://localhost:3000/api

- `@ApiBearerAuth('accessToken')` — Authorization: Bearer 헤더
- `@ApiCookieAuth('refreshToken')` — 쿠키 인증

Phase 1에서 신규 엔드포인트/DTO에 현 패턴(`@ApiOperation`, `@ApiProperty`) 계승. Phase 5에서 @nestjs/swagger 11 업그레이드 + CLI plugin + `@ApiParam`/`@ApiQuery` 전수 적용 + 응답 스키마 일관화 (기존 이슈 #45).

## Implementation Rules (API Server)

- 인증 기본값: 전역 AuthGuard, 공개 엔드포인트는 `@Public()` 화이트리스트
- 응답 일관성: SuccessResponse / FailureResponse 통일 (HTTP 200)
- 리스트 상한: PaginationDto TAKE=20 (Phase 1부터 커서 기반 전환)
- 트랜잭션: 다중 쓰기는 원자성 보장
- 요청 추적: Winston 구조화 로깅, 일별 로테이션. Phase 2에서 Correlation ID 자동 주입
- N+1 방지: `getPostLikeMapByPostIds()` batch loading 패턴 준수

### NestJS / TypeORM 특화

- 모듈 경계: exports/imports로 해결. 다른 모듈의 Provider를 직접 providers에 등록 금지
- 트랜잭션: 다중 쓰기는 QueryRunner 명시 트랜잭션 (startTransaction → commit/rollback → release)
- Repository 에러: `findOneOrFail`/`findOneByOrFail` 사용 시 EntityNotFoundError → 도메인 예외 변환. 캐시 사용 시 에러 핸들링에서 캐시 무효화 포함
- 쿼리 최적화: find/findOne 호출 시 select로 컬럼 명시, 민감 컬럼(password, salt) 제외
- 환경변수: `process.env` 직접 접근 금지. `ConfigService` 또는 `@Inject(config.KEY)` 사용
- Global Module: Phase 2 observability 모듈은 NestJS Global Module로 등록하여 feature 모듈에서 import 없이 inject 가능하게 구성
- Path 파라미터 변환: 전역 `PathParamAwareValidationPipe`가 path param의 ValidationPipe `transformPrimitive`를 우회하므로, 핸들러가 `: number`/`: boolean` 등 원시 타입을 받으려면 `@Param('name', ParseIntPipe)` 형태로 적합한 `Parse*Pipe` 또는 `DecryptPrimaryKeyPipe`를 명시 부착해야 한다. 시그니처만 `: number`로 두면 string 원문이 흘러 typeof 단언이 깨진다 (정적 분석 미감지)

## [확정]/[가이드] 구분

Solution 문서의 [확정] 항목은 구조적 결정으로 변경 시 /mcpsi-meeting-log → MCPSI 재수립이 필요하다. 자의적 변경 금지. [가이드] 항목은 구현 세부이며 더 나은 방법 발견 시 자율 개선 허용. 리뷰 피드백과 충돌 시 [가이드]는 수용 판단, [확정]은 거부 대신 에스컬레이션(사용자 보고 → 재수립 권고).

## 기술 블로그 문서화 규칙

핵심 기술 결정과 실측 결과를 외부 독자가 읽는 기술 블로그로 남긴다. 블로그 문서는 MCPSI 계획의 산출물이며, 별도 관리 파일을 두지 않는다.

### 주제 선언 위치

MCPSI implementation-guide.md "Phase 산출 문서" 섹션에서 Phase별로 선언. 선언된 주제는 issue-plan.md에서 독립 이슈로 생성.

### 블로그 이슈 두 타입

Type A 설계:

- 시점: Solution 확정 직후 (구현 대기 없음)
- depends_on: solution 문서
- 중점: 검토한 선택지, 트레이드오프, 최종 결정 근거
- 재료: solution.md, context의 기각 대안, 방법론 참조

Type B 회고:

- 시점: 관련 구현/측정 이슈 모두 완료 후
- depends_on: 구현 이슈 + 측정 이슈
- 중점: 실측 수치, 예상 못 한 난관, 튜닝 과정, 회고
- 재료: PR/커밋, 부하 테스트 결과, 운영 중 발견 사항

### 주제별 독립 판단

모든 주제가 A/B 둘 다 필요하지는 않다. 주제별 독립 판단:

- Type A 확정 조건: 검토한 대안 2개 이상 + 기각 사유 명확
- Type B 확정 조건: 실측 데이터 있음 / 비자명한 난관 / 외부 독자에게 재현 가능한 가이드가 될 수 있음 (셋 중 하나)
- 배제 조건: MCPSI 문서만으로 외부 독자가 충분히 이해 가능 (순수 컨벤션/관례)

### issue-plan.md 블로그 이슈 필드

- `type: narrative-design` 또는 `type: narrative-retrospective`
- 작성 포인트: 핵심 주제 한 줄
- 중점 내용: 독자가 가져갈 것 리스트 (Type B는 "예상 중점"으로 기록 후 작성 직전 재확정)
- aggregates: 집계 대상 이슈 번호
- depends_on: 선행 이슈 번호
- pair_with: A/B 쌍이면 상대 이슈 번호
- 산출물 경로: `docs/tech-notes/<slug>.md`

### Type B 중점 재확정 절차

Type B 이슈 본문에 "작성 직전 중점 재확정" 체크리스트 포함. 선행 이슈 완료 후 실제 서사 기준으로 중점 재확정한 뒤 작성 착수.

### 블로그 문서 표준 구성

```
1. 배경 — 이 실험/결정이 필요했던 맥락
2. 문제 정의 — 무엇을 해결해야 했는가
3. Type A: 검토한 선택지와 트레이드오프 / Type B: 구현 중 부딪힌 지점과 우회
4. Type A: 최종 선택과 근거 / Type B: 검증 결과 (측정 수치 포함)
5. 구현 방향 또는 코드 해설
6. 회고 / 한계 / 후속 실험
7. 참조 — MCPSI solution.md §N 링크
```

MCPSI 문서가 authoritative. 결정 번복 시 MCPSI부터 수정 후 블로그 재작성.
