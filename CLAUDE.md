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

### Module Structure

```text
src/
├── blog/           # Blog feature module (posts, likes, comments)
├── user/           # User feature module (auth, profile)
├── config/         # TypeORM, Redis, Winston, JWT, env validation
├── decorator/      # @Public(), @Roles(), @AuthenticatedUserValidation()
├── filter/         # Global HttpExceptionFilter
├── exception/      # Custom exceptions (BaseException)
└── utils/          # Crypto, pagination, cache key utilities
```

### Layered Architecture Pattern

Each feature module follows: `Controller → Service → Repository → Entity`

- Controllers: HTTP handling + Swagger docs
- Services: Business logic
- Repositories: TypeORM queries
- DAOs: Entity → DTO transformation
- DTOs: Request/response validation with class-validator

## Authentication Flow

JWT with access/refresh token pattern:

1. Global `AuthGuard` intercepts all requests (except `@Public()` routes)
2. Access token verified from `Authorization: Bearer` header
3. Refresh token verified from HTTPOnly cookie against DB (server-side session validation)
4. Both tokens must be valid for request to pass — enables immediate session revocation
5. If access token expired, client calls `POST /users/auth/refresh` with refresh token cookie to obtain new tokens
6. Refresh Token Rotation: refresh 시 access + refresh token 모두 재발급

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

## Key Patterns

### N+1 Query Optimization

Post queries batch-load likes via `getPostLikeMapByPostIds()` instead of individual queries per post.

### Pagination

Standard pagination via `PaginationDto` with page/limit params. Response includes total count metadata.

### Error Handling

Global `HttpExceptionFilter` catches all errors and returns consistent `FailureResponse` format. Logs full stack traces for non-HTTP exceptions.

## Environment Setup

```bash
# Start MySQL and Redis
docker-compose up -d

# Environment file
env/.development.env
```

Required env vars: `DB_*`, `REDIS_*`, `JWT_*`, `COOKIE_*`, `PK_SECRET_KEY` (16 chars)

## Testing Patterns

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

Test files located alongside source: `*.service.spec.ts`

### E2E Tests

E2E tests use real database with Docker containers.

```bash
# Start test containers (MySQL + Redis)
docker-compose -f docker-compose.test.yaml up -d

# Run E2E tests
npm run test:e2e
```

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

## API Documentation

Swagger UI available at `http://localhost:3000/api` when running locally.
