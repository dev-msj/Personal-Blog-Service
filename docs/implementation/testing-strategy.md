# Testing Strategy — Phase 0: 기반 확보

## 개요

Phase 0은 인프라 변경 위주 Phase로, 도메인 단위 테스트 신규 추가가 적다. 핵심 전략:

1. 기존 14개 unit test + 3개 E2E test의 회귀 방지
2. migration 활성화 후 E2E가 globalSetup migration 자동 실행 환경에서 정상 동작하는지 검증
3. #67 (E2E HealthModule CACHE_MANAGER 의존성)의 정상화로 health endpoint E2E 신뢰성 확보
4. 인프라 작업의 수동/CLI 검증 단계 명시 (자동화 비용 대비 가치 낮은 영역)

문서 출처: implementation-guide.md §작업 흐름 1~5 / data-design.md §Phase 0 / security.md §3.

## 검증 분류

### 자동화 테스트 (회귀 보호)

- 기존 unit test 14개 (auth/jwt/user-info/post/post-like service, interceptor, pipe, utils, filter, health, DTO) 통과 유지
- 기존 E2E test 3개 (user-auth.e2e-spec.ts, post.e2e-spec.ts, app.e2e-spec.ts) 통과 유지
- migration 활성화 후 E2E 환경에서 globalSetup이 migration 자동 실행 + 기존 DbCleaner truncate가 정상 동작 확인

### 수동 / CLI 검증

- nvm use → npm install → 빌드/테스트 통과 (Node 버전 선언)
- npm install 후 lockfile에서 redis 의존성 제거 확인 (redis 의존성 정리)
- npm run migration:run / revert / show 양방향 작동 (migrations 활성화)
- 의도적 더미 시크릿 commit 시도 → 차단 (gitleaks)

### Property-Based Testing

Phase 0은 새로운 도메인 Invariant 도출이 없으므로 적용 대상 부재. Phase 1부터 도입 예정 (User Aggregate 재설계 시 (provider, providerSubject) UNIQUE Invariant, Comment/Reply 깊이 1 Invariant 등이 PBT 후보).

### Specification by Example

Phase 0은 비즈니스 시나리오 변경 부재 → 적용 대상 없음. Phase 1 댓글/답글 도입 시 Given-When-Then 시나리오 도입 예정.

### Decision Table 매핑

problem.md §Decision Tables 명시 "해당 없음" — Phase 0 적용 부재. ADMIN 차등 권한 도입 트리거(Out-of-scope) 충족 시 Decision Table 등장 가능.

### Use Case Extensions 매핑

Phase 0은 도메인 Use Case 변경 부재. 대신 implementation-guide.md §작업 흐름 1~5의 정상 / 검증 / 실패·롤백 경로가 Use Case Extensions 역할을 수행하여 구현자 결정점을 고정한다 (writing-principles.md "Use Case Extensions" 의도 충족).

## 이슈별 테스트 항목

### #75 — Node.js 22.x LTS 버전 일관 선언

**검증**:
- `node --version` 출력이 .nvmrc와 일치 (v22.x.y)
- `npm install` 정상 종료. EBADENGINE warning 없음
- 기존 unit test 14개 전체 통과 (`npm run test`)
- 기존 E2E test 3개 전체 통과 (`npm run test:e2e`) — 단, #77 / #79 완료 후 globalSetup 추가된 환경 전제
- `npm run build` 통과
- GitHub Actions workflow 실행 시 setup-node@v4 step에서 v22 활성화 로그 확인

**회귀**: 기존 unit/E2E 동작 영향 없음. Node 22는 Jest 29 / NestJS 10 / TypeScript 5.1 모두 호환 범위 내 (context.md [의존성 버전 갭 분석] 참조).

### #76 — 미사용 redis 의존성 제거

**검증**:
- `node_modules/redis` 디렉토리 부재 (`ls node_modules/redis` → 에러)
- `grep -r "from 'redis'" src/` 결과 0건
- `npm run test:e2e` 통과 — 특히 health endpoint Redis 검사가 cache-manager-ioredis 경유로 정상 동작 (#77 완료 전제)
- `npm run build` 통과

**회귀**: HealthModule Redis 검사 통과 유지. cache-manager-ioredis (^2.1.0)는 redis 패키지에 의존하지 않으므로 영향 없음.

### #77 — E2E HealthModule CACHE_MANAGER 의존성 해결 (#67 흡수)

**검증**:
- `npm run test:e2e` 통과
- 격리된 health endpoint 테스트(현 app.e2e-spec.ts 또는 신규 health.e2e-spec.ts)에서 `GET /health` → 200 + `{ database: { status: 'up' }, redis: { status: 'up' } }` 응답
- HealthController.spec.ts (unit) 통과 유지
- HealthModule을 standalone moduleFixture(다른 모듈 import 없이)로 부트해도 정상 init (자기완결성 검증 — 선택)

**회귀**:
- 기존 user-auth.e2e-spec.ts / post.e2e-spec.ts 통과 유지
- AppModule의 CacheModule 전역 등록은 유지되므로 다른 모듈의 cache 사용에 영향 없음

### #79 — TypeORM migrations 활성화 + InitialSchema export

**검증**:
- `npm run migration:run` → InitialSchema가 적용. `migrations` 테이블에 timestamp 레코드 1건 INSERT
- `npm run migration:revert` → InitialSchema rollback. 모든 도메인 테이블 DROP, `migrations` 테이블 레코드 삭제
- `npm run migration:show` → InitialSchema 적용 상태 [X] 표시
- `npm run migration:generate -- migrations/Empty` → entity 변경 없으면 빈 파일 또는 "No changes" 메시지
- `npm run test:e2e` 통과 — globalSetup이 자동 실행되어 테스트 시작 전 스키마 준비. DbCleaner truncate가 정상 동작
- 기존 3개 E2E (user-auth, post, app)가 회귀 없이 통과

**데이터 무결성 검증** (선택):
- synchronize:true로 생성된 스키마와 InitialSchema 적용 결과 비교: `mysqldump --no-data` 출력을 두 환경에서 diff. 차이 없어야 함 (CHARSET, ENGINE, AUTO_INCREMENT 시작값 등 미세 차이 허용)

**회귀**:
- 기존 E2E 3개 모두 통과
- typeOrmConfig의 cache 옵션 (테스트 환경 비활성, 개발 환경 Redis) 동작 변경 없음

### #78 — gitleaks pre-commit 훅 추가

**검증**:
- 의도적 더미 시크릿(예: AWS access key 형식 `AKIAIOSFODNN7EXAMPLE`) 추가 후 `git commit` 시도 → gitleaks가 차단 (exit code 1)
- 정상 변경 commit → 통과
- 기존 lint-staged 동작 (ESLint --fix + Prettier --write) 유지
- pre-push 훅 (`npm run build`)는 영향 없음

**회귀**:
- env/.development.env / env/.test.env의 placeholder 값이 false positive로 감지되지 않음 (베이스라인 정리 전제)
- 기존 src/ 파일 수정 후 정상 commit 가능

## 테스트 환경

- Docker Compose 테스트 컨테이너 유지: MySQL 3307, Redis 6380 (`docker-compose -f docker-compose.test.yaml up -d`)
- jest-e2e.json `maxWorkers: 1` 유지 (DB 충돌 방지)
- 신규: `globalSetup: <rootDir>/global-setup.ts` 추가 (#79 작업물)
- testTimeout: 30000ms 유지 (globalSetup 추가로 첫 실행 시간 약간 증가하나 30s 충분)
- forceExit: true 유지

## Phase 0 완료 판정 기준

다음 모두 충족 시 Phase 0 close + Phase 1 진입 가능 (implementation-guide.md §Phase 1 진입 조건과 정합):

- 5개 이슈 모두 close
- `npm run test` 전체 통과 (14개 unit test)
- `npm run test:e2e` 전체 통과 (3개 E2E test, globalSetup migration 자동 실행 포함)
- `npm run build` 통과
- pre-commit 훅 정상 동작 (lint-staged + gitleaks)
- pre-push 훅 정상 동작 (npm run build)
- GitHub Actions workflow 정상 동작 (setup-node 22.x)
- migration 양방향 동작 검증 완료
