---
migrated: abundant-nibbling-toast-S-2
---

# Context — Constraints

기술 제약·기술 환경 조사 결과·기존 코드 상태. 비즈니스 맥락은 overview.md, 도메인 모델은 domain.md.

## 연동 요구사항

- Google OAuth 2.0 ID Token 검증 (google-auth-library 라이브러리). 환경변수 GOOGLE_CLIENT_ID 필요. Anticorruption Layer 수준의 단방향 의존 (외부 → 내부 User Aggregate 변환)
- 기존 시스템 마이그레이션 요구사항 없음 (그린필드)

## 인프라·예산·인력 제약

- 인력: 1명 (사용자 본인)
- 예산: 현재 자체 개발 장비에서 로컬 Docker Compose 실행만 전제 (추가 비용 없음)
- 클라우드 배포는 예산 여유 확보 시 검토 (unknowns.md "기술/코드"로 승계)
- 부하 테스트도 현 단계에서는 로컬 환경 기준

## 기술 스택 제약

확정된 스택 (기존 구현 기반, Phase 0 closure 반영):

- 런타임: Node.js 22.x LTS (`.nvmrc` = 22, `package.json` engines = `>=22.0.0 <23.0.0`, GitHub Actions setup-node 일관 선언 — Phase 0 #75 적용 완료)
- 프레임워크: NestJS 10 (Phase 5에서 NestJS 11 + TS 6 + Jest 30 업그레이드 예정)
- TypeScript: strictNullChecks, noImplicitAny, target ES2021
- ORM: TypeORM 0.3.x (쿼리 캐시 활성, 테스트 환경은 비활성 분기, migrations 활성 — Phase 0 #79 적용 완료)
- DB: MySQL 8.0
- 캐시: Redis (ioredis 클라이언트, NestJS CacheModule + 자체 ioredis Provider 공유)
- 테스트: Jest (unit + supertest 기반 E2E)
- 검증: Joi (환경변수), class-validator (DTO)
- 인증: jsonwebtoken (passport 미사용, 직접 구현)
- 로깅: nest-winston + winston-daily-rotate-file (Phase 2에서 구조화 JSON 포맷 + Correlation ID 자동 주입 + PII 마스킹 도입 예정)
- 암호화: crypto-js (AES-ECB, Phase 5에 AES-GCM 전환 예정)
- OAuth: google-auth-library
- 환경: Docker Compose
- 시크릿 스캔: gitleaks (Phase 0 #78 pre-commit 훅 적용 완료)

컨테이너 포트:
- 개발: MySQL 3306, Redis 6379 (docker-compose.yaml)
- 테스트: MySQL 3307, Redis 6380 (docker-compose.test.yaml, MySQL healthcheck 포함)
- 테스트 DB/캐시 경로: data/mysql-test, data/redis-test

## 기술 환경 조사 결과

### JWT 토큰 무효화 전략 (Phase 0 baseline, PR #44 파생)

3가지 전략 비교:
- 블랙리스트(Denylist): 무효화된 토큰만 등록. 등록 전까지 탈취 토큰 유효 (한계)
- Allowlist(세션 ID): 유효 세션만 허용. 별도 세션 인프라 구축 부담
- Refresh Token 서버측 검증: 매 요청마다 refreshToken을 DB 저장값과 대조

채택: Refresh Token 서버측 검증. 근거는 (1) 기존 UserAuthEntity.refreshToken 필드 활용으로 추가 스키마 변경 없음 (2) HTTPOnly 쿠키 기반 XSS 방어 계층 확보 (3) Token Rotation으로 replay 방어 내장. 현 한계: 매 요청 DB 직접 조회로 성능 부담. 향후 cache-aside(Redis) 적용 계획.

상세 문서: docs/tech-notes/token-validation-strategies/

### 의존성 버전 갭 분석 (2026-04-24 수행 → 2026-05-11 Phase 0 closure 반영)

주요 major 갭 (Problem/Solution 단계의 업그레이드 판단 입력):
- NestJS 10 → 11: Express v5 경로 매칭(와일드카드 명명 강제), CacheModule의 Keyv 전환(cache-manager-ioredis 어댑터 호환성 재검증 필요), Reflector 반환 타입 변경, 종료 lifecycle hook 순서 역전 → Phase 5 편입 예정
- TypeScript 5 → 6 (stable) / 7 (Beta 진행 중, Go 기반 컴파일러). 6는 JS 기반 마지막 릴리스이자 7 전환 준비 성격 → Phase 5 편입 예정
- Jest 29 → 30: Node 18+ 요구 → Node 22 LTS 선언(Phase 0 #75)으로 전제 충족. Phase 5 편입 예정
- TypeORM 0.3.17 → 0.3.28: 같은 0.3.x 계열 내 patch/minor 갭. 파괴적 변경 가능성 낮음

Phase 0에서 해소된 구조적 공백:
- ✅ Node.js 런타임 버전 선언 (#75: .nvmrc + engines + GitHub Actions 3곳 일관 선언)
- ✅ `redis ^5.8.2` 미사용 의존성 제거 (#76)
- ✅ TypeORM migrations 활성화 + synchronize:false 전환 + InitialSchema export (#79)
- ✅ HealthModule E2E 격리 부트 + RedisHealthIndicator 단일 ioredis Provider inject (#77, #85, #86)
- ✅ gitleaks pre-commit 훅 (#78)
- ✅ 전역 ValidationPipe path 파라미터 NaN 변환 결함 수정 (#89)

남은 Phase 5 업그레이드 항목: unknowns.md "기술/코드" 8번 항목으로 승계.

## 기존 코드 상태 (2026-05-11 기준)

모듈 구성:
- auth/ (전역 AuthGuard)
- blog/ (posts, likes)
- user/ (auth, profile, OAuth, jwt)
- health/ (Redis health check, HealthModule 자기완결성 부트)
- redis/ (NestJS CacheModule + 자체 ioredis Provider 공유, OnModuleDestroy로 graceful 종료)
- config/ (TypeORM, Redis, Winston, JWT, env validation)
- migrations/ (Phase 0 #79부터 활성. InitialSchema 1개 등록)
- constant/, decorator/, filter/, interceptor/, pipe/, exception/, response/, utils/

엔티티 (4개):
- UserAuthEntity: uid(PK, 100자), password, salt, refreshToken, socialYN(char), userRole(enum), 타임스탬프
- UserInfoEntity: uid(PK, 100자), nickname(UNIQUE, 100자), introduce(500자), 타임스탬프
- PostEntity: postId(AUTO_INCREMENT PK), postUid(INDEX, 100자), title(500자), contents(text), hits(int, default 0), writeDatetime, 타임스탬프
- PostLikeEntity: (postId + uid) 복합 PK, 타임스탬프

관계:
- UserAuth 1:1 UserInfo (CASCADE)
- UserAuth 1:N Post (CASCADE, postUid 외래키)
- UserAuth 1:N PostLike (CASCADE)
- Post 1:N PostLike (CASCADE)

Phase 1에서 user/user_auth/user_auth_provider/user_info/comment/reply 구조로 전면 재설계 예정 (data-design.md §Phase 1).

엔드포인트 (16개):
- 공개(@Public): POST /users/auth/join, /users/auth/login, /users/auth/refresh, /users/auth/oauth
- 유저 정보: POST/GET/PATCH/DELETE /users/info (@Roles USER, ADMIN)
- 글: GET /posts, GET /posts/users/:postUid, GET /posts/:postId, POST /posts, PATCH /posts/:postId, DELETE /posts/:postId (모두 @Roles USER)
- 좋아요: POST /posts/:postId/likes, DELETE /posts/:postId/likes (@Roles USER)

테스트:
- Unit: NestJS Test.createTestingModule + mocked repository, 소스와 동일 위치 (`*.spec.ts`)
- E2E: 4개 파일 (user-auth, post, app, health). maxWorkers=1, testTimeout=30s. globalSetup이 `dataSource.runMigrations()` 자동 실행 (Phase 0 #79)
- 테스트 환경: 실제 Docker 컨테이너 (docker-compose.test.yaml)

마이그레이션 상태 (2026-05-11 기준):
- migrations/ 활성. synchronize:false 강제 (config/typeOrmConfig.ts, config/data-source.ts)
- 현재 등록 migration 1개: InitialSchema (Phase 0 #79에서 entity diff 기반 자동 생성)
- E2E globalSetup이 runMigrations() 자동 실행 (test/global-setup.ts)
- Phase 1 첫 실제 데이터 보존형 마이그레이션 사례: User Aggregate 재설계 (TP5)

문서-코드 불일치 (2026-04-24 식별, 후속 과제):
- CLAUDE.md의 UserInfoEntity에 profileImageUrl, bio 기재되어 있던 과거 흔적은 해소 — 현 CLAUDE.md는 introduce 필드 1개 명기로 정정됨

## 보안 관련 경로 후보 (security Extension 입력)

- 인증 진입점: src/auth/auth.guard.ts, src/user/service/user-auth.service.ts, src/user/service/jwt.service.ts
- 시크릿 관리: 환경변수 PK_SECRET_KEY(정확히 16자, Phase 5에 32자 AES-256으로 확장 예정), JWT_SECRET, GOOGLE_CLIENT_ID, REDIS_PASSWORD, DB_PASSWORD
- 비밀번호 해싱: SHA256 3회 반복 + salt → Phase 5에서 argon2id 전환 예정
- PK 보호: AES-ECB (src/utils/crypto.utils.ts) → Phase 5에서 AES-GCM 전환 예정
- 쿠키: HTTPOnly + secure(프로덕션) + sameSite=strict 기본
- 시크릿 사고 방지: gitleaks pre-commit 훅 (Phase 0 #78)

## CI/CD

- GitHub Actions `.github/workflows/main.yml`
- 트리거: 브랜치 생성 (create 이벤트)
- 동작: 브랜치명에서 이슈 번호 추출 → GitHub Projects V2에서 해당 이슈를 "In Progress"로 자동 이동
- 필요 secret: PROJECT_TOKEN
- Node.js 버전 일관 선언: Phase 0 #75에서 setup-node 단계 추가됨 (.nvmrc 동기)

## Git 전략

- GitHub Flow
- 브랜치 네이밍: `<타입>/<이슈번호>-<설명>` (feature / bugfix / hotfix / refactor / docs)
- 머지: Squash Merge, 머지 후 원격/로컬 브랜치 삭제
- 훅: Husky + lint-staged
  - pre-commit: ESLint --fix + Prettier --write
  - pre-commit: gitleaks 시크릿 스캔 (Phase 0 #78)
  - pre-push: npm run build

## Sources

- docs/meeting-logs/2026-04-24.md §결정 1, 6 / §미결정 3 (의존성 갭, 부하 테스트)
- docs/meeting-logs/2026-05-11.md §결정 1 (Phase 0 종료 — 8개 이슈 closure 반영)
- 기존 코드베이스 분석 (Explore, 2026-04-24): 엔티티/엔드포인트/모듈 구조/테스트
- 코드 직접 확인 (2026-05-11): .nvmrc, package.json engines, src/migrations/, src/config/data-source.ts
- package.json (패키지 의존성 관리 소스)
- docs/tech-notes/token-validation-strategies/ (Phase 0 Type A 블로그)
- 의존성 버전 갭 조사 (2026-04-24 WebSearch): NestJS 11, Node.js LTS 일정, TypeScript 6/7, TypeORM 0.3.x, Jest 30
- 백업: .claude/migrations/abundant-nibbling-toast-S-2/backup/docs/context.md
