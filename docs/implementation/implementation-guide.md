# Implementation Guide — Phase 0: 기반 확보

## Phase 0 개요

- 해결 대상 Problem: BP5 / TP7
- Solution 출처:
  - overview.md §Phase 정의 — "Phase 0: 기반 확보"
  - application-arch.md §Phase별 진화 로드맵 Phase 0 행 (migrations 활성화 + gitleaks pre-commit)
  - data-design.md §Phase 0: 기반 확보 — migrations 활성화 (synchronize:false 전환, 기준 마이그레이션 export, 스크립트 등록, E2E 갱신)
  - security.md §3 시크릿 관리 — gitleaks pre-commit 훅 [가이드]
- Phase 1 진입 게이트 의미: Phase 1 User Aggregate 재설계(uid VARCHAR → user_id BIGINT FK 전파, user_auth_provider 신설, 외래키 재배치)는 데이터 보존형 마이그레이션이 필수이며, synchronize:true로는 처리 불가. Phase 0 migrations 활성화가 Phase 1 모든 작업의 선행 조건

## Scope

### In Scope (Phase 0)

- Node.js 22.x Maintenance LTS 버전 선언 (.nvmrc + package.json engines + GitHub Actions setup-node)
- 미사용 redis 의존성 제거
- E2E HealthModule CACHE_MANAGER 의존성 해결 (기존 이슈 #67 흡수)
- TypeORM migrations 활성화 (synchronize:false 전환 + InitialSchema export + npm scripts + E2E globalSetup 통합)
- gitleaks pre-commit 훅 추가 + 베이스라인 정리

### Out of Scope (Phase 0)

- bcrypt/argon2 비밀번호 해싱 전환 → Phase 5 TP8 / security.md §1
- AES-ECB → AES-GCM 전환 → Phase 5 TP8 / security.md §4
- NestJS 10→11, TypeScript 5→6, Jest 29→30 등 메이저 업그레이드 → Phase 5
- Correlation ID 전파, observability 모듈 신설 → Phase 2
- 본격 CI 파이프라인(빌드/테스트 자동 실행 워크플로우) → Phase 5 또는 클라우드 배포 트리거 시

## Phase 0의 특수성

Phase 0은 도메인 유즈케이스(UC-1~7) 변경이 없는 인프라 작업 Phase다. writing-principles.md "유즈케이스 실현 흐름"은 Phase 0에 직접 적용되지 않으므로, 본 가이드는 인프라 작업 흐름 중심으로 구성한다. 각 흐름의 정상 경로 / 검증 / 실패·롤백 경로 / 변경 파일을 고정하여 구현자 결정점을 제거한다.

확정된 사용자 결정 (5개 이슈 분해 입력):
- Node.js 22.x Maintenance LTS 채택 — 기존 @types/node ^20.3.1과의 갭이 작은 보수적 선택
- gitleaks 실행 방식: `npx gitleaks protect --staged --redact` (별도 binary 설치 없이 실행)
- 기존 오픈 이슈 #67 (E2E HealthModule CACHE_MANAGER 의존성) Phase 0 흡수

## 작업 흐름

### 흐름 1. Node 22.x LTS 버전 선언

#### 정상 경로

1. 프로젝트 루트에 `.nvmrc` 신설. 단일 라인 `22` (또는 `lts/jod` 코드네임). 22 line 안에서 nvm이 최신 patch 자동 선택
2. `package.json`에 `engines` 필드 추가:
   ```json
   "engines": { "node": ">=22.0.0 <23.0.0" }
   ```
   - 22 메이저 한정. 23 진입 시 즉시 경고
3. `.github/workflows/main.yml`에 setup-node step 추가. 현 workflow는 actions/github-script만 사용하지만, 향후 빌드/테스트 워크플로우 확장의 베이스라인으로 setup-node를 jobs.move-to-in-progress.steps 첫 단계로 등록:
   ```yaml
   - uses: actions/setup-node@v4
     with:
       node-version-file: '.nvmrc'
   ```
   - `node-version-file` 사용으로 .nvmrc와 단일 진실 공급원 유지

#### 검증

- `nvm use` (Linux/macOS) 또는 `nvm use $(cat .nvmrc)` (Windows nvm-windows) → 활성 Node 버전이 22.x인지 확인
- `node --version` 출력이 v22.x.y인지 확인
- `npm install` 정상 종료 (engines 검증 통과). lockfile 변동 없음
- `npm run test` / `npm run test:e2e` / `npm run build` 모두 통과
- GitHub Actions workflow 실행 시 setup-node step이 v22 활성화 로그 출력

#### 실패 / 롤백 경로

- engines 위배 (Node < 22 환경에서 npm install): `EBADENGINE` warning. 학습 프로젝트라 strict 모드 미설정이므로 warning만. 개발자가 nvm use로 전환 권장
- 기존 코드가 Node 22에서 동작하지 않는 경우: 보고된 사례 없음. 발생 시 .nvmrc / engines를 20으로 임시 하향 후 재조사
- 롤백: 3개 파일 변경분 revert. lockfile 영향 없음

#### 변경 파일

- `.nvmrc` (신설)
- `package.json` (engines 필드 추가)
- `.github/workflows/main.yml` (setup-node step 추가)

---

### 흐름 2. 미사용 redis 의존성 제거

#### 사전 확인

- src 내 `from 'redis'` import 0건 (이전 Phase 1 분석 결과 — context.md [의존성 버전 갭 분석] "redis ^5.8.2 패키지 선언되어 있으나 src 내 직접 import 없음")
- 실제 Redis 통신은 `cache-manager-ioredis` 어댑터 경유 (src/health/indicator/redis.health-indicator.ts의 CACHE_MANAGER inject가 ioredis 클라이언트 노출)
- 따라서 `redis` 패키지 제거가 런타임 동작에 영향 없음

#### 정상 경로

1. `package.json` dependencies에서 `"redis": "^5.8.2"` 라인 제거
2. `npm install` 실행 → package-lock.json에서 redis 및 transitive dep 제거
3. 컴파일/테스트로 회귀 검증

#### 검증

- `npm install` 후 `node_modules/redis` 디렉토리 부재 확인
- `npm run build` 통과
- `npm run test` 통과 (14개 unit test)
- `npm run test:e2e` 통과 (3개 E2E test) — 특히 health endpoint Redis 검사가 cache-manager-ioredis 경유로 정상 동작하는지 확인 (단, 흐름 3 #67 해결과 의존)
- `grep -r "from 'redis'" src/` 결과 0건 재확인

#### 실패 / 롤백 경로

- 누락된 transitive 사용 발견 시: `npm install redis@^5.8.2`로 즉시 복원
- 롤백: package.json 변경분 revert + `npm install`

#### 변경 파일

- `package.json` (dependencies에서 redis 제거)
- `package-lock.json` (자동 갱신)

---

### 흐름 3. E2E HealthModule CACHE_MANAGER 의존성 해결 (#67 흡수)

#### 원인 분석

- `src/health/health.module.ts`는 `CacheModule`을 import하지 않고 `RedisHealthIndicator`만 providers에 등록
- `RedisHealthIndicator`(src/health/indicator/redis.health-indicator.ts)는 `@Inject(CACHE_MANAGER)`로 cache-manager 인스턴스 주입 받음
- 앱 전역에서는 AppModule이 CacheModule.registerAsync(isGlobal: true)로 등록하여 동작
- E2E `app.e2e-spec.ts`의 moduleFixture는 AppModule을 import한 뒤 `.overrideModule(CacheModule).useModule(CacheModule.register({ isGlobal: true }))`로 override. 이 과정에서 CacheModule 인스턴스가 in-memory store(기본값)로 교체되며 `cacheManager.store.getClient()`가 미정의 → RedisHealthIndicator 실행 시 TypeError
- 결과: E2E HealthModule 관련 테스트가 격리 환경에서 실패 (#67)

#### 권장 해결: HealthModule 자기완결성 확보

HealthModule 자체에 CacheModule을 import하여 앱 전역 import에 의존하지 않도록 수정. E2E override의 영향을 받지 않으면서 RedisHealthIndicator가 항상 Redis 연결된 cache-manager를 inject 받도록 보장.

#### 정상 경로

1. `src/health/health.module.ts`에 CacheModule.registerAsync 직접 import 추가:
   ```ts
   imports: [
     TerminusModule,
     CacheModule.registerAsync(redisCacheConfig),  // src/config/redis.config.ts 등 기존 redisCacheConfig 재사용
   ],
   ```
   - `redisCacheConfig`는 AppModule이 사용하는 동일한 설정 객체를 재사용. 신규 설정 작성 금지 (단일 진실 공급원)
2. AppModule의 CacheModule 전역 등록은 유지 (다른 모듈이 inject 가능하도록). HealthModule은 자체 CacheModule 인스턴스를 사용

#### 대안 경로 (참고용, 비권장)

- `app.e2e-spec.ts`의 CacheModule override 시 cache-manager-ioredis store를 명시적으로 등록: 테스트 코드 복잡도 증가 + 다른 E2E 파일에 동일 처리 누락 시 재발

#### 검증

- `npm run test:e2e` 통과
- 신규 또는 기존 E2E 테스트에서 `GET /health` 호출 시 200 응답 + database/redis 둘 다 up 상태
- HealthController.spec.ts unit test (현재 14개 중 1개) 통과 유지
- Health endpoint를 격리 environment(다른 모듈 import 없는 minimal moduleFixture)에서도 정상 동작 확인 (구현자 선택: app.e2e-spec.ts에 health 검증 추가 또는 별도 health.e2e-spec.ts 신설)

#### 실패 / 롤백 경로

- CacheModule 중복 등록으로 인한 충돌: NestJS는 동일 모듈을 여러 곳에서 import해도 single instance로 공유. 충돌 발생 가능성 낮음
- redisCacheConfig 재사용 경로가 순환 의존을 유발하면 별도 헬스 전용 cache-manager 인스턴스를 inline 등록하는 fallback 가능
- 롤백: health.module.ts 변경분 revert. 단, #67이 다시 발현되므로 별도 이슈로 재오픈 필요

#### 변경 파일

- `src/health/health.module.ts` (CacheModule.registerAsync import 추가)
- 필요 시 `test/app.e2e-spec.ts` (CacheModule override 라인 단순화 또는 제거 가능 — RedisHealthIndicator가 자기 모듈 내 CacheModule을 사용하므로 override 불필요해질 수 있음. 구현 시점에 영향 범위 확인)

---

### 흐름 4. TypeORM migrations 활성화

#### 정상 경로

1. **synchronize 동작 변경**:
   - `src/config/typeOrmConfig.ts` 현 코드:
     ```ts
     synchronize: configService.get('DB_SYNCHRONIZE') === 'true',
     ```
   - 변경: `synchronize: false`로 강제. DB_SYNCHRONIZE 환경변수는 env/.development.env / env/.test.env에서 'false'로 명시 (구현자 판단 — 변수 자체 제거도 가능하나, 학습 가치 측면에서 명시적 false 권장)
   - 추가: `migrationsRun: false` (런타임 자동 실행은 비활성. 명시적 npm script 호출로만 실행)
   - 추가: `migrations: ['dist/migrations/*.js']` (런타임 — 빌드된 JS) 또는 `['migrations/*.ts']` + tsconfig 분리 (개발 환경 ts-node 실행 시)

2. **TypeORM CLI용 DataSource 신설** (TypeOrmModuleAsyncOptions와 별도 필요):
   - `src/config/data-source.ts` 신설. TypeORM CLI(`typeorm-ts-node-commonjs`)는 NestJS DI 컨테이너 외부에서 실행되므로 ConfigService를 사용할 수 없음. dotenv로 직접 env 로드 + `new DataSource({...})` export
   - 구조 예시:
     ```ts
     import 'dotenv/config';
     import { DataSource } from 'typeorm';
     // env 로드 (NODE_ENV에 따라 .development.env / .test.env 분기)
     export default new DataSource({
       type: 'mysql',
       host: process.env.DB_HOST,
       // ... typeOrmConfig.ts와 동일 필드 ...
       entities: ['src/**/*.entity.ts'],
       migrations: ['migrations/*.ts'],
     });
     ```
   - 의존성: `typeorm` 패키지가 이미 ^0.3.17로 설치됨. CLI는 `npx typeorm-ts-node-commonjs` 형태로 실행 가능 (별도 devDependency 추가 불필요. 다만 ts-node가 ^10.9.1로 이미 설치되어 동작)

3. **InitialSchema 마이그레이션 export**:
   - 명령:
     ```
     npx typeorm-ts-node-commonjs migration:generate -d src/config/data-source.ts migrations/InitialSchema
     ```
   - 결과: `migrations/{timestamp}-InitialSchema.ts` 파일 생성. 현 4개 엔티티(UserAuthEntity, UserInfoEntity, PostEntity, PostLikeEntity)의 CREATE TABLE 문이 up()에, DROP TABLE 문이 down()에 자동 작성됨
   - 사전 조건: 빈 DB에서 generate 실행해야 정확한 export 가능. 기존 data/mysql-test 또는 개발 DB가 비어있는 상태에서 실행

4. **package.json scripts 추가**:
   ```json
   "typeorm": "typeorm-ts-node-commonjs -d src/config/data-source.ts",
   "migration:run": "npm run typeorm -- migration:run",
   "migration:revert": "npm run typeorm -- migration:revert",
   "migration:generate": "npm run typeorm -- migration:generate",
   "migration:show": "npm run typeorm -- migration:show"
   ```

5. **E2E globalSetup 신설**:
   - `test/global-setup.ts` 신설. Jest globalSetup hook에서 `migration:run` 동등 동작 호출 (DataSource.initialize() → runMigrations() → destroy())
   - `test/jest-e2e.json`에 `"globalSetup": "<rootDir>/global-setup.ts"` 추가
   - 동작: E2E 테스트 시작 전에 테스트 DB 스키마를 migration으로 준비. 기존 DbCleaner는 데이터 정리만 담당
   - 주의: 테스트 컨테이너가 사전 기동된 상태 전제 (docker-compose -f docker-compose.test.yaml up -d). globalSetup이 컨테이너 시작까지 책임지지 않음

6. **개발 환경 적용**:
   - 개발 환경 컨테이너 기동 후 `npm run migration:run` 1회 실행으로 스키마 준비
   - 또는 docker-compose에 init script로 통합 (구현자 선택. 학습 가치는 명시적 실행이 더 큼)

#### 상태 모델

migration 단일 파일 상태:
```
pending (typeorm migrations 테이블에 미등록)
  → running (migration:run 실행 중)
    → completed (migrations 테이블에 timestamp 등록됨)
    → failed (트랜잭션 롤백, migrations 테이블 미반영)
```

#### 검증

- `npm run migration:show` → InitialSchema가 [X] (적용됨) 상태로 출력
- `npm run migration:revert` → InitialSchema rollback. 모든 테이블 DROP. `migration:show`에서 [ ] (미적용)
- `npm run migration:run` → InitialSchema 재적용. 모든 테이블 재생성
- entity 변경이 없는 상태에서 `npm run migration:generate -- migrations/Empty` 실행 → "No changes in database schema were found" 메시지 또는 빈 마이그레이션 파일 (TypeORM 동작에 따름)
- `npm run test:e2e` 통과 — globalSetup이 자동으로 migration 실행하여 스키마 준비, 기존 3개 E2E test가 회귀 없이 통과

#### 실패 / 롤백 경로

- **migration:generate 결과 빈 파일**:
  - 원인: entities glob 패턴 불일치. `src/**/*.entity.ts`가 실제 entity 파일을 잡지 못함
  - 대응: data-source.ts의 entities 경로 확인. UserAuthEntity 등이 정확히 매칭되는지 검증
- **"Table already exists" 에러 (migration:run 시)**:
  - 원인: 기존 data/mysql 또는 data/mysql-test 디렉토리에 synchronize:true로 생성된 스키마 잔존
  - 대응 옵션 A: 컨테이너 down + 데이터 디렉토리 삭제 + 컨테이너 up + migration:run (학습 프로젝트라 데이터 손실 허용)
  - 대응 옵션 B: migrations 테이블에 InitialSchema를 baseline INSERT (기존 스키마를 InitialSchema가 적용한 것으로 간주). DDL: `INSERT INTO migrations (timestamp, name) VALUES ({timestamp}, 'InitialSchema{timestamp}');`
- **E2E globalSetup 실패**:
  - 원인: 테스트 컨테이너 미기동 또는 healthcheck 미통과
  - 대응: globalSetup 진입 시 connect retry (5회, 2초 간격) 또는 사전 컨테이너 기동 안내 메시지 출력

#### 변경 파일

- `src/config/typeOrmConfig.ts` (synchronize:false 강제 + migrations 옵션)
- `src/config/data-source.ts` (신설 — TypeORM CLI 전용 DataSource)
- `package.json` (scripts 5종 추가)
- `migrations/{timestamp}-InitialSchema.ts` (신설 — generate 결과)
- `test/global-setup.ts` (신설 — E2E globalSetup)
- `test/jest-e2e.json` (globalSetup 등록)
- `env/.development.env` / `env/.test.env` (DB_SYNCHRONIZE=false 명시 — 가이드 수준)

---

### 흐름 5. gitleaks pre-commit 훅 추가

#### 정상 경로

1. **현재 .husky/pre-commit 확장**:
   - 현 내용: `npx lint-staged` 단일 라인
   - 변경 후:
     ```
     npx lint-staged
     npx gitleaks protect --staged --redact
     ```
   - `--staged`: staged 파일만 검사 (커밋 단위 방어)
   - `--redact`: 검출된 시크릿을 출력에서 마스킹 (콘솔 노출 방지)
   - npx 사용으로 별도 binary 설치 없이 실행 (사용자 결정)

2. **베이스라인 정리** (필요 시):
   - 첫 실행 시 false positive 가능 영역:
     - `env/.development.env`, `env/.test.env`의 placeholder 값 (DB_PASSWORD 등)
     - `key/` 디렉토리(있다면) 내 샘플 키
   - 대응 옵션 A: `.gitleaksignore` 파일에 false positive 라인 명시 (`<file>:<rule_id>:<commit>` 형식)
   - 대응 옵션 B: `.gitleaks.toml`에 [allowlist] 규칙으로 path 또는 regex 패턴 등록
   - 학습 프로젝트라 옵션 A 권장 (단순)

3. **검증 시나리오**:
   - 의도적 더미 시크릿(예: `AKIAIOSFODNN7EXAMPLE` 같은 AWS access key 형식)을 임의 파일에 추가하여 commit 시도 → gitleaks가 차단해야 함
   - 정상 commit (시크릿 없는 변경)이 차단되지 않아야 함

#### 검증

- 더미 시크릿 commit 시도 → exit code 1 + 차단 메시지 출력
- 정상 commit → 통과
- `npx lint-staged`도 함께 동작 (ESLint --fix + Prettier --write 유지)
- pre-push (`npm run build`) 별도 동작 유지 (이번 흐름과 무관)

#### 실패 / 롤백 경로

- **Windows에서 npx gitleaks 첫 실행 시 다운로드 실패**:
  - 원인: 네트워크 또는 npm cache 문제
  - 대응: 별도 설치 (winget install gitleaks 또는 chocolatey) 후 `gitleaks protect --staged --redact`로 npx 제거
  - 학습 프로젝트라 npx 우선, 실패 시 fallback 안내 README/CLAUDE.md에 추가
- **false positive로 정상 커밋 차단**:
  - 대응: `.gitleaksignore`에 해당 라인 등록 후 재시도
- 롤백: `.husky/pre-commit`에서 gitleaks 라인 제거 → 즉시 복귀

#### 변경 파일

- `.husky/pre-commit` (gitleaks 라인 추가)
- `.gitleaksignore` 또는 `.gitleaks.toml` (false positive 베이스라인 — 필요 시)

---

## 작업 간 의존

- **흐름 4 (migrations 활성화) ← 흐름 3 (#67 hotfix)**:
  - 흐름 4의 검증 채널 핵심이 E2E globalSetup이므로, 그 전에 E2E가 안정적으로 통과해야 함. #67 미해결 상태로 globalSetup을 추가하면 실패 원인 분리 곤란
  - 권장: 흐름 3 → 흐름 4 순서로 처리 (이슈 4에 consumes 명시)

- **나머지 흐름 (1, 2, 5)은 독립**:
  - 흐름 1 (Node 버전): 환경 표준 확립. 다른 흐름과 직접 의존 없음 (Jest 30 등 상위 도구 도입 시 선행 조건이지만 Phase 0 범위에서는 무관)
  - 흐름 2 (redis 제거): 의존성 정리. cache-manager-ioredis 정상성은 흐름 3 검증과 겹치지만 작업 자체는 독립
  - 흐름 5 (gitleaks): 커밋 훅 추가. 다른 흐름과 무관

## 데이터 모델 / Aggregate Invariant

Phase 0은 도메인 모델 변경이 없다. data-design.md §Phase 0 명시: "스키마 형상 자체의 변경은 없으나 스키마 변경 관리 방식이 근본적으로 변경된다". 구체적 스키마 진화는 Phase 1부터 시작.

Aggregate Invariant 추가/변경 없음 (problem.md §도메인 Invariant 12개 그대로 유지).

## 인터페이스 시그니처

Phase 0에서 도입되는 인터페이스(코드 수준)는 다음 2개:

1. **TypeORM CLI DataSource** (`src/config/data-source.ts` default export):
   ```ts
   export default new DataSource({
     type: 'mysql',
     host: string, port: number, username: string, password: string, database: string,
     entities: string[],
     migrations: string[],
   });
   ```

2. **Jest globalSetup** (`test/global-setup.ts` default export):
   ```ts
   export default async function (): Promise<void>;
   ```
   동작: dotenv .test.env 로드 → DataSource initialize → runMigrations → destroy

## Phase 1 진입 조건

Phase 0의 5개 이슈가 모두 close되고 다음을 모두 만족:

1. `node --version`이 22.x 출력
2. `npm install` 후 lockfile 재생성 시 redis 패키지 부재
3. `npm run test:e2e` 통과 (HealthModule CACHE_MANAGER 정상 + globalSetup migration 자동 실행 정상)
4. `npm run migration:run` / `npm run migration:revert` 양방향 동작
5. 의도적 더미 시크릿 커밋 시도 시 gitleaks 차단
6. GitHub Actions setup-node 22.x로 동작
7. pre-commit / pre-push 훅 정상 동작 (lint-staged + gitleaks + npm run build)

위 7개 조건이 충족되면 Phase 1 (User Aggregate 재설계 + 댓글/답글/중복 요청 방지 + 커서 페이징) /mcpsi-implementation 호출 가능.
