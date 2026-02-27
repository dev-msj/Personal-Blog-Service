# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Development
npm run start:dev          # Run with watch mode (auto-restart on changes)
npm run start:debug        # Run with debugger enabled

# Production
npm run build              # Compile TypeScript to dist/
npm run start:prod         # Run compiled dist/main.js

# Code Quality
npm run lint               # ESLint with auto-fix
npm run format             # Prettier formatting

# Testing
npm run test               # Run all unit tests
npm run test:watch         # Run tests in watch mode
npm run test:cov           # Generate coverage report
npm run test:e2e           # Run e2e tests

# Run single test file
npx jest path/to/file.spec.ts
npx jest --testPathPattern="post.service"
```

## Architecture Overview

Framework: NestJS 10 with TypeScript
Database: MySQL 8.0 + Redis (cache) via Docker Compose
ORM: TypeORM with query caching
Testing: Jest (unit + E2E with supertest)
Validation: Joi (env schema), class-validator (DTO)
Auth: jsonwebtoken (passport 미사용, 직접 구현)
Logging: nest-winston + winston-daily-rotate-file
Encryption: crypto-js (비밀번호 해싱, PK 암호화)
OAuth: google-auth-library (Google 소셜 로그인)

### Module Structure

```text
src/
├── auth/           # AuthGuard (전역 인증 가드)
├── blog/           # Blog feature module (posts, likes)
├── user/           # User feature module (auth, profile, OAuth)
├── config/         # TypeORM, Redis, Winston, JWT, env validation (Joi)
├── constant/       # ErrorCode enum, UserRole enum
├── decorator/      # @Public(), @Roles(), @AuthenticatedUserValidation(), @EncryptField()
├── filter/         # 타입별 Exception Filters (BaseException, HttpException, Unhandled)
├── interceptor/    # EncryptPrimaryKeyInterceptor (응답 PK 암호화)
├── pipe/           # DecryptPrimaryKeyPipe (요청 PK 복호화)
├── exception/      # Custom exceptions (abstract BaseException + 도메인별 하위 디렉토리: auth/, user/, blog/, validation/)
├── response/       # BaseResponseDto, SuccessResponse, FailureResponse, Swagger options
└── utils/          # Crypto, pagination (TAKE=20 고정), cache key, time utilities
```

### Layered Architecture Pattern

Each feature module follows: `Controller → Service → Repository → Entity`

- Controllers: HTTP handling + Swagger docs
- Services: Business logic
- Repositories: TypeORM queries
- DAOs: Entity → DTO transformation
- DTOs: Request/response validation with class-validator
- Pipes: `DecryptPrimaryKeyPipe` (암호화된 path param → 복호화, 유효하지 않은 값은 BaseException(INVALID_ENCRYPTED_PARAMETER))
- Interceptors: `EncryptPrimaryKeyInterceptor` (응답 DTO의 `@EncryptField()` 필드 자동 암호화), `SetRefreshTokenCookieInterceptor` (user 모듈, refreshToken 쿠키 자동 설정)

Feature module 내부 구조:
```text
blog/: controller/ dao/ dto/ dto/interface/ entities/ repository/ service/
user/: controller/ dao/ dto/ dto/interface/ entities/ interceptor/ repository/ service/
```

### App Configuration (setupApp)

- CORS: `enableCors({ origin: true, credentials: true })` — 모든 origin 허용
- ValidationPipe (전역): `whitelist: true, transform: true, enableImplicitConversion: true`
- cookieParser 미들웨어 등록
- 전역 Guard: `APP_GUARD` → `AuthGuard` (app.module.ts)
- 전역 Filter: `APP_FILTER` → `BaseExceptionFilter`, `HttpExceptionFilter`, `UnhandledExceptionFilter` (app.module.ts)

## HTTP Response Convention

**항상 HTTP 200 반환** — REST 표준이 아닌 커스텀 방식:
- 성공: `SuccessResponse { code, message, data }`
- 실패: `FailureResponse { code, message }` (HTTP 200 + body 내 에러 코드)
- 타입별 Exception Filter가 모든 예외를 잡아 HTTP 200 + `FailureResponse`로 변환

ErrorCode enum — 5자리 도메인별 코드 체계:
- Auth (10xxx): `AUTH_UNAUTHORIZED`, `AUTH_INVALID_PASSWORD`, `AUTH_INVALID_OAUTH_TOKEN`, `AUTH_REFRESH_TOKEN_REQUIRED`, `AUTH_INVALID_REFRESH_TOKEN`
- User (20xxx): `USER_NOT_FOUND`, `USER_ALREADY_EXISTS`, `USER_INFO_NOT_FOUND`, `USER_INFO_ALREADY_EXISTS`
- Post (30xxx): `POST_NOT_FOUND`
- PostLike (31xxx): `POST_LIKE_ALREADY_EXISTS`, `POST_LIKE_NOT_FOUND`
- Common (90xxx): `COMMON_BAD_REQUEST`, `COMMON_UNAUTHORIZED`, `COMMON_NOT_FOUND`, `COMMON_NOT_ACCEPTABLE`, `COMMON_CONFLICT`, `COMMON_INTERNAL_ERROR`, `COMMON_SERVICE_UNAVAILABLE`
- Validation (91xxx): `INVALID_ENCRYPTED_PARAMETER`, `INVALID_PAGE`

## Authentication Flow

JWT with access/refresh token pattern:

1. Global `AuthGuard` intercepts all requests (except `@Public()` routes)
2. Access token verified from `Authorization: Bearer` header
3. Refresh token verified from HTTPOnly cookie against DB (server-side session validation)
4. Both tokens must be valid for request to pass — enables immediate session revocation
5. If access token expired, client calls `POST /users/auth/refresh` with refresh token cookie to obtain new tokens
6. Refresh Token Rotation: refresh 시 access + refresh token 모두 재발급
7. `SetRefreshTokenCookieInterceptor`: 응답에 `JwtDto` 포함 시 refreshToken HTTPOnly 쿠키 자동 설정

### Google OAuth

- `POST /users/auth/oauth` — Google ID Token 검증 후 자동 회원가입/로그인
- `google-auth-library`로 토큰 검증, `GOOGLE_CLIENT_ID` 환경변수 필요

Key decorators:

- `@Public()` - Skip authentication
- `@Roles(UserRole.USER)` - Role-based access
- `@AuthenticatedUserValidation()` - Inject authenticated user ID

## Database Entities

UserAuthEntity (USER_AUTH): uid, password, salt, refreshToken, userRole, socialYN
UserInfoEntity (USER_INFO): uid, nickname, profileImageUrl, bio
PostEntity (POST): postId, postUid, title, contents, hits, timestamps
PostLikeEntity (POST_LIKE): composite key (postId + uid)

Primary keys are AES-encrypted in API responses using `PK_SECRET_KEY`.
- 요청: `DecryptPrimaryKeyPipe`가 암호화된 path param을 복호화 (Controller 진입 전)
- 응답: `EncryptPrimaryKeyInterceptor`가 `@EncryptField()` DTO 필드를 암호화 (Controller 반환 후)
- Service/DAO 레이어는 암복호화에 관여하지 않음 (평문 number/string 사용)

UserSessionEntity: TypeORM 엔티티가 아닌 인메모리 값 객체 — RefreshToken 검증 결과를 담는 DTO.

## Key Patterns

### N+1 Query Optimization

Post queries batch-load likes via `getPostLikeMapByPostIds()` instead of individual queries per post.

### Pagination

Standard pagination via `PaginationDto` with page/limit params. 페이지당 고정 20개 (`TAKE = 20`). Response includes total count metadata.

### Error Handling

타입별 Exception Filter 계층 (`AbstractExceptionFilter` 공통 상속):

| Filter | `@Catch` 대상 | 역할 |
|--------|--------------|------|
| `BaseExceptionFilter` | `BaseException` | `errorCode` 응답 반영 |
| `HttpExceptionFilter` | `HttpException` | NestJS 표준 HTTP 예외 처리 |
| `UnhandledExceptionFilter` | `()` catch-all | 500 변환, 원본 에러 로깅 |

`BaseException` 계층: `BaseException`(abstract, protected constructor) → 도메인별 구체 예외 클래스:
- `auth/`: `AuthUnauthorizedException`, `AuthInvalidPasswordException`, `AuthInvalidOauthTokenException`, `AuthRefreshTokenRequiredException`, `AuthInvalidRefreshTokenException`
- `user/`: `UserNotFoundException`, `UserAlreadyExistsException`, `UserInfoNotFoundException`, `UserInfoAlreadyExistsException`
- `blog/`: `PostNotFoundException`, `PostLikeAlreadyExistsException`, `PostLikeNotFoundException`
- `validation/`: `InvalidPageException`, `InvalidEncryptedParameterException`
- 범용: `UnexpectedCodeException` (어떤 ErrorCode든 받을 수 있는 fallback)

새 예외 추가 시: ErrorCode enum 도메인 그룹과 일치하는 하위 디렉토리에 클래스 생성, barrel index.ts에 export 추가.

### Logging

nest-winston + winston-daily-rotate-file:
- 프로덕션: error 레벨 일별 로테이션
- 개발: info 레벨
- 로그 디렉토리: `logs/error/`, `logs/info/`, 최대 30일 보관, zip 압축
- 테스트 환경: 파일 로거 비활성화 (Jest 종료 문제 방지)

## Environment Setup

```bash
# Start MySQL and Redis (development)
docker-compose up -d

# Start test containers (별도 포트: MySQL 3307, Redis 6380)
docker-compose -f docker-compose.test.yaml up -d

# Environment files
env/.development.env    # 개발 환경
env/.test.env           # 테스트 환경
```

### Required Environment Variables

| Category | Variables |
|----------|-----------|
| DB | `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `DB_SYNCHRONIZE` |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_TTL` |
| JWT | `JWT_SECRET`, `JWT_ISSUER`, `JWT_ACCESSTOKEN_EXPIRE_TIME` (기본 1h), `JWT_REFRESHTOKEN_EXPIRE_TIME` (기본 30d) |
| Cookie | `COOKIE_MAX_AGE` (기본 30일 ms), `COOKIE_SECURE` (production 자동), `COOKIE_SAME_SITE` (기본 strict) |
| Encryption | `PK_SECRET_KEY` (16 chars) |
| OAuth | `GOOGLE_CLIENT_ID` |

### Docker Compose 환경 차이

| 항목 | 개발 (docker-compose.yaml) | 테스트 (docker-compose.test.yaml) |
|------|---------------------------|----------------------------------|
| MySQL 포트 | 3306:3306 | 3307:3306 |
| Redis 포트 | 6379:6379 | 6380:6379 |
| healthcheck | 없음 | MySQL healthcheck 있음 |
| 데이터 경로 | `data/mysql`, `data/redis` | `data/mysql-test`, `data/redis-test` |

TypeORM 특이사항: 테스트 환경에서는 Redis 캐시 비활성화 (`isTestEnv` 분기).

## Git Hooks (Husky + lint-staged)

- **pre-commit**: `npx lint-staged` — `.ts` 파일에 eslint --fix + prettier --write
- **pre-push**: `npm run build` — 빌드 검증

## TypeScript Configuration

주목할 설정:
- `strictNullChecks: true` — null/undefined 타입 체크 활성화
- `noImplicitAny: true` — 암시적 any 금지
- `target: ES2021`
- ESLint: `@typescript-eslint/no-explicit-any: warn` (점진적 제거), `explicit-function-return-type: off`
- Prettier: `endOfLine: auto` (CRLF/LF 혼용 허용, Windows 환경)

## Testing Patterns

테스트 성숙도: **도입 완료** — 단위 테스트 + E2E 테스트 프레임워크 구성됨.

### Unit Tests

Unit tests use NestJS `Test.createTestingModule` with mocked repositories:

```typescript
const module: TestingModule = await Test.createTestingModule({
  providers: [
    PostService,
    { provide: PostRepository, useValue: mockPostRepository },
    { provide: ConfigService, useValue: mockConfigService },
  ],
}).compile();
```

Test files located alongside source: `*.service.spec.ts`, `*.utils.spec.ts`

### E2E Tests

E2E tests use real database with Docker containers.

```bash
# Start test containers (MySQL 3307, Redis 6380)
docker-compose -f docker-compose.test.yaml up -d

# Run E2E tests
npm run test:e2e
```

E2E 설정 (`jest-e2e.json`):
- `maxWorkers: 1` — 병렬 실행 금지 (DB 충돌 방지)
- `testTimeout: 30000` (30초)
- `forceExit: true`
- `setup.ts`: dotenv 사전 로드 + `NODE_ENV=test` 설정

Test utilities in `test/utils/`:

- `DbCleaner`: Database cleanup between tests (`cleanTables()`, `cleanCache()`)
- `AuthHelper`: JWT token generation for authenticated requests

```typescript
// E2E test example
beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  configureApp(app);  // Apply same middleware as main.ts
  await app.initialize();
});

beforeEach(async () => {
  await dbCleaner.cleanTables([Tables.POST_LIKE, Tables.POST, Tables.USER_INFO, Tables.USER_AUTH]);
  await dbCleaner.cleanCache();
});

afterAll(async () => {
  await app.close();
});
```

E2E test files located in `test/`: `*.e2e-spec.ts`

## Git 규칙

### 브랜치 규칙

- 브랜치 전략: GitHub Flow
- 브랜치 네이밍: `<타입>/<이슈번호>-<간단한-설명>`
  - 예: `feature/12-social-login`, `bugfix/45-login-validation`
- 브랜치 타입:
  - `feature`: 새 기능 추가
  - `bugfix`: 버그 수정
  - `hotfix`: 긴급 수정 (프로덕션 이슈)
  - `refactor`: 코드 리팩토링 (기능 변경 없음)
  - `docs`: 문서 작업

### 구현 절차

글로벌 작업 절차 Phase B를 따른다.

프로젝트 특화 규칙:

- 머지 전략: Squash Merge
- 머지 후: 브랜치 삭제 (원격/로컬)

## GitHub Actions

`.github/workflows/main.yml`:
- 트리거: 브랜치 생성 (`create` 이벤트)
- 동작: 브랜치명에서 이슈 번호 추출 → GitHub Projects V2에서 해당 이슈를 "In Progress"로 자동 이동
- 필요 secret: `PROJECT_TOKEN`

## API Documentation

Swagger UI available at `http://localhost:3000/api` when running locally.
- `@ApiBearerAuth('accessToken')` — Authorization: Bearer 헤더
- `@ApiCookieAuth('refreshToken')` — 쿠키 인증

## Implementation Rules (API Server)

- 인증 기본값: 모든 엔드포인트 인증 적용 (AuthGuard 전역), 공개 엔드포인트는 `@Public()`으로 명시적 화이트리스트
- 응답 일관성: 모든 응답 `SuccessResponse` / `FailureResponse` 형식 통일 (HTTP 200 고정)
- 리스트 상한: 리스트 응답에 페이지네이션 적용 (`PaginationDto`, TAKE=20 고정)
- 트랜잭션: 다중 쓰기 작업은 트랜잭션으로 원자성 보장, 부분 실패 방지
- 요청 추적: 요청 ID(correlation ID) 기반 Winston 구조화 로깅, 일별 로테이션 파일
- N+1 방지: ORM 쿼리 수 확인, batch loading 패턴 (`getPostLikeMapByPostIds()`)

### NestJS/TypeORM 특화 규칙

- 모듈 경계: 모듈 간 의존성은 `exports`/`imports`로 해결, 다른 모듈의 Provider를 직접 `providers`에 등록 금지
- 트랜잭션 구현: 다중 쓰기 작업은 `QueryRunner` 기반 명시적 트랜잭션 (`startTransaction` → `commit`/`rollback` → `release`)
- Repository 에러 처리: `findOneOrFail`/`findOneByOrFail` 사용 시 `EntityNotFoundError` → `NotFoundException` 변환, 캐시 사용 시 에러 핸들링에서 캐시 제거 포함
- 쿼리 최적화: `find`/`findOne` 호출 시 필요한 컬럼만 `select` 옵션으로 명시, 민감 컬럼(`password`, `salt`) 제외
- 환경변수 접근: `process.env` 직접 접근 금지, `ConfigService` 또는 `@Inject(config.KEY)` 패턴 사용

# currentDate
Today's date is 2026-02-25.
