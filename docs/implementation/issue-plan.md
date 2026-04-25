# Issue Plan — Phase 0: 기반 확보

## 이슈 목록 (5개)

### #75 [Refactor] Node.js 22.x LTS 버전 일관 선언 (.nvmrc + engines + GitHub Actions) [closed]

- **변경 파일**: `.nvmrc` (신설), `package.json` (engines 필드 추가), `.github/workflows/main.yml` (setup-node step 추가)
- **작업 설명**: Node.js 런타임 버전을 세 지점(.nvmrc / package.json engines / GitHub Actions setup-node)에 일관되게 22.x Maintenance LTS로 선언. 개발자 로컬 환경 암묵 의존을 제거하고 재현성/CI 리스크를 해소. Jest 30 등 상위 도구 도입(Phase 5)의 선행 조건도 본 작업으로 충족.
- **Solution 참조**:
  - overview.md §[확정] 런타임/프레임워크 계층 — "Node.js 런타임 (Phase 0에서 버전 선언 예정)"
  - context.md [의존성 버전 갭 분석] "Node.js 런타임 버전 선언 누락: .nvmrc, package.json engines 필드, GitHub Actions workflow의 node-version 모두 미선언"
  - problem.md TP7 + BP5
- **Implementation 참조**: implementation-guide.md §흐름 1, testing-strategy.md §#75
- **완료 기준**:
  - .nvmrc 파일에 `22` 단일 라인 존재
  - package.json engines.node에 `>=22.0.0 <23.0.0` 명시
  - GitHub Actions setup-node@v4 step에서 .nvmrc 참조 동작
  - `nvm use` 후 `node --version`이 22.x
  - npm install 정상 + 기존 test 통과
- **라벨**: type/refactor, scope/infra, priority/medium
- **provides**:
  - 환경 표준: Node.js 22.x Maintenance LTS 명시
  - 파일: `.nvmrc`, `package.json` engines 필드
- **consumes**: 없음

### #76 [Refactor] 미사용 redis 의존성 제거 [closed]

- **변경 파일**: `package.json` (dependencies에서 redis 제거), `package-lock.json` (자동 갱신)
- **작업 설명**: package.json에 선언된 `redis ^5.8.2` 패키지가 src 내 직접 import 0건이며 실제 Redis 통신은 cache-manager-ioredis 어댑터 경유. 미사용 의존성 제거로 빌드/설치 시간 및 보안 surface 축소.
- **Solution 참조**:
  - context.md [의존성 버전 갭 분석] "redis ^5.8.2 패키지 선언되어 있으나 src 내 직접 import 없음(실제 사용은 cache-manager-ioredis). 제거 후보 또는 용도 확인 필요"
  - problem.md BP5
- **Implementation 참조**: implementation-guide.md §흐름 2, testing-strategy.md §#76
- **완료 기준**:
  - package.json dependencies에서 `"redis"` 제거
  - package-lock.json에서 redis 및 transitive dep 제거
  - `npm install` + `npm run test:e2e` 통과 (특히 health endpoint Redis 검사 정상)
- **라벨**: type/refactor, scope/backend, priority/low
- **provides**:
  - 의존성 정리: redis 패키지 제거
- **consumes**: 없음

### #77 [Bug] E2E HealthModule CACHE_MANAGER 의존성 해결 (#67 흡수)

- **변경 파일**: `src/health/health.module.ts`, (선택) `test/app.e2e-spec.ts` (CacheModule override 단순화 가능 시)
- **작업 설명**: HealthModule이 CacheModule을 자체 import하지 않아 E2E moduleFixture 격리 환경에서 RedisHealthIndicator의 CACHE_MANAGER inject가 in-memory store로 대체되어 `cacheManager.store.getClient()` 호출 시 TypeError 발생(#67). HealthModule에 CacheModule.registerAsync를 직접 import하여 자기완결성 확보. 앱 전역 CacheModule 등록에 의존하지 않음.
- **원인**: src/health/health.module.ts에는 TerminusModule만 import. RedisHealthIndicator는 @Inject(CACHE_MANAGER)로 cache-manager 인스턴스 의존. E2E의 CacheModule override가 in-memory store를 주입하면서 ioredis client 부재로 실패.
- **Solution 참조**: 해당 없음 (Phase 0 인프라 안정화 일환. 기존 오픈 이슈 #67 흡수)
- **Implementation 참조**: implementation-guide.md §흐름 3, testing-strategy.md §#77
- **완료 기준**:
  - `npm run test:e2e` 통과
  - 격리된 health endpoint 테스트에서 `GET /health` → 200 + database/redis 둘 다 up
  - HealthController.spec.ts (unit) 통과 유지
- **라벨**: type/bug, scope/backend, priority/medium
- **기존 이슈**: #67 흡수 → 본 이슈 close 시 #67도 close
- **provides**:
  - HealthModule 자기완결성: CacheModule.registerAsync 내장 import
- **consumes**: 없음

### #79 [Refactor] TypeORM migrations 활성화 + InitialSchema export [조립 레이어]

- **변경 파일**:
  - `src/config/typeOrmConfig.ts` (synchronize:false 강제 + migrations 옵션)
  - `src/config/data-source.ts` (신설 — TypeORM CLI 전용 DataSource)
  - `package.json` (scripts: typeorm/migration:run/revert/generate/show)
  - `migrations/{timestamp}-InitialSchema.ts` (신설 — generate 결과)
  - `test/global-setup.ts` (신설 — E2E globalSetup)
  - `test/jest-e2e.json` (globalSetup 등록)
  - `env/.development.env`, `env/.test.env` (DB_SYNCHRONIZE=false 명시 — 가이드)
- **작업 설명**: TypeORM synchronize:true 운영 + migrations/ 빈 디렉토리 상태를 해소. synchronize:false 전환 + 현 4개 엔티티(UserAuth/UserInfo/Post/PostLike) 스키마를 InitialSchema 마이그레이션 파일로 export. npm scripts 5종 추가. E2E globalSetup으로 테스트 시작 시 migration 자동 실행 통합. Phase 1 User Aggregate 재설계의 데이터 보존형 마이그레이션 인프라를 본 작업으로 선행 확보.
- **Solution 참조**:
  - data-design.md §Phase 0: 기반 확보 (synchronize:false 전환 + InitialSchema export + npm scripts + E2E globalSetup)
  - problem.md TP7 + 알려진 불확실성 7 (프로덕션 마이그레이션 전략 — Phase 0에서 해소)
  - application-arch.md §Phase별 진화 로드맵 Phase 0 행 (migrations 활성화)
  - overview.md §Phase 정의 Phase 0
- **Implementation 참조**: implementation-guide.md §흐름 4, testing-strategy.md §#79
- **완료 기준**:
  - typeOrmConfig synchronize:false 강제
  - migrations/{timestamp}-InitialSchema.ts 파일 존재 + up()/down() 모두 작성됨
  - npm run migration:run / revert / show 정상 동작
  - test/global-setup.ts에서 migration 자동 실행
  - 기존 3개 E2E test 회귀 없이 통과
- **라벨**: type/refactor, scope/infra, scope/database, priority/high
- **[조립 레이어]**: package.json scripts + typeOrmConfig + data-source + globalSetup의 통합 노드. 단일 작업으로 묶여야 동작 일관성 보장.
- **provides**:
  - TypeORM migration 인프라: synchronize:false 강제 + migrations/ 활성
  - npm scripts: migration:run / migration:revert / migration:generate / migration:show / typeorm
  - E2E 자동 실행: jest-e2e.json globalSetup
  - 파일: src/config/data-source.ts (CLI 전용 DataSource), migrations/{timestamp}-InitialSchema.ts, test/global-setup.ts
- **consumes**:
  - HealthModule 자기완결성 (← #77): E2E를 검증 채널로 사용. #67 미해결 상태로 globalSetup을 추가하면 실패 원인 분리 곤란
- **blocks**: `Phase 1 마일스톤 전체 이슈군` (Phase 1 분해 시점에 본 라인을 구체 이슈 번호 목록으로 치환 필요 — `Phase 0 완료 시 후속 안내` 섹션의 갱신 의무 참조) — 사유: Phase 1 User Aggregate 재설계(uid VARCHAR → user_id BIGINT FK 전파, user_auth_provider 신설, 외래키 재배치)의 데이터 보존형 마이그레이션이 본 이슈 완료 후에만 가능. Phase 1 진입 게이트.

### #78 [Feature] gitleaks pre-commit 훅 추가

- **변경 파일**: `.husky/pre-commit`, (필요 시) `.gitleaksignore` 또는 `.gitleaks.toml`
- **작업 설명**: 시크릿 노출 방지를 위해 .husky/pre-commit에 `npx gitleaks protect --staged --redact` 추가. 사용자 결정에 따라 npx 사용 (별도 binary 설치 없음). 첫 도입 시 false positive 검출 영역(env/ placeholder 등)은 .gitleaksignore로 베이스라인 정리.
- **Solution 참조**:
  - security.md §3 시크릿 관리 — [가이드] 시크릿 노출 방지 — gitleaks pre-commit 훅 (Phase 0 편입 결정)
  - application-arch.md §Phase별 진화 로드맵 Phase 0 행 (gitleaks pre-commit 훅 추가)
- **Implementation 참조**: implementation-guide.md §흐름 5, testing-strategy.md §#78
- **완료 기준**:
  - .husky/pre-commit에 gitleaks 라인 포함
  - 의도적 더미 시크릿 commit 시도 → 차단
  - 정상 commit 통과
  - 기존 lint-staged 동작 유지
- **라벨**: type/feature, scope/infra, priority/medium
- **provides**:
  - 시크릿 노출 방지 훅: gitleaks pre-commit
- **consumes**: 없음

## 병렬 트랙 구조 (CPM 기반)

### 크리티컬 패스

`#77 → #79` (2 wave)

### Wave 1 (의존 없음 — 병렬 가능)

- **#75**: Node.js 22.x LTS 버전 일관 선언
  - provides: 환경 표준 (Node.js 22.x), 파일 (.nvmrc, package.json engines)
  - consumes: 없음
- **#76**: 미사용 redis 의존성 제거
  - provides: 의존성 정리 (redis 패키지 제거)
  - consumes: 없음
- **#77**: E2E HealthModule CACHE_MANAGER 의존성 해결 (#67 흡수)
  - provides: HealthModule 자기완결성 (CacheModule.registerAsync 내장)
  - consumes: 없음
- **#78**: gitleaks pre-commit 훅 추가
  - provides: 시크릿 노출 방지 훅
  - consumes: 없음

### Wave 2

- **#79**: TypeORM migrations 활성화 [조립 레이어] ← #77
  - provides: migration 인프라 + npm scripts + E2E globalSetup + src/config/data-source.ts + migrations/{timestamp}-InitialSchema.ts + test/global-setup.ts
  - consumes: HealthModule 자기완결성 (← #77) — E2E 검증 채널 정상화 전제
  - blocks: `Phase 1 마일스톤 전체 이슈군` (Phase 1 분해 시점 구체 이슈 번호로 치환 필요 — 본 문서 §`Phase 0 완료 시 후속 안내` §`본 plan의 Phase 1 시점 갱신 의무` 참조) — 사유: User Aggregate 재설계 데이터 보존형 마이그레이션 선행 조건

## 권장 작업 순서

### 탐색 규칙

다음 작업 선정 시:
1. 후보 X에 대해 모든 오픈 이슈의 blocks 필드를 스캔. Y.blocks 목록에 X가 포함된 오픈 Y가 있으면 Y를 선 처리 대상으로 분류하고 X는 주 권장 후보에서 제외
2. 핵심 경로 상위 항목은 blocks 역추적 결과 오픈 blocker가 모두 해소된 후에만 권장 가능
3. [조립 레이어] 태그 이슈는 consumes 계약 또는 공유 파일 경로를 수정하는 오픈 이슈 전체의 blocks 타겟이 되어야 함 (plan 작성 의무). 누락이 있으면 B15 파일/스키마 교차 검증에서 탐지
4. coord는 병행 가능 후보 surface 용도. 작업 순서 제약이 아님 — 순서 제약은 blocks 또는 consumes로 표기해야 함

### 핵심 경로

- #77 → #79 (E2E 검증 채널 정상화 → migrations 활성화)

### blocker 선 처리 대상 (blocks 역추적)

- #79가 Phase 1 전체를 blocks. Phase 1 진입 전 필수 close.
- 따라서 #79를 마지막으로 두되, Wave 1의 다른 이슈들과 병행하지 않고 순서상 가장 늦게 시작하는 것이 검증 안정성 확보에 유리

### 권장 1인 작업 순서

1. **#75** (Node 버전): 독립, 빠른 완료. 환경 표준 먼저 확립
2. **#76** (redis 제거): 독립, 빠른 완료. 의존성 정리
3. **#78** (gitleaks): 독립, 빠른 완료. 이후 모든 커밋에서 시크릿 방어
4. **#77** (#67 hotfix): #79 선행 조건. E2E 검증 채널 정상화
5. **#79** (migrations 활성화): 마지막. Phase 1 진입 게이트. globalSetup이 정상 통과하는 환경 위에 추가

### 병렬 작업 시 (참고)

- Wave 1의 #75/#76/#77/#78은 동시 진행 가능 (충돌 파일 없음)
- #79만 Wave 2로 분리. Wave 1의 #75/#76/#77/#78 중 #77이라도 완료되면 #79 시작 가능

## Phase 0 완료 시 후속 안내

Phase 0의 5개 이슈 모두 close된 후:

1. `/clear` 실행 (대화 컨텍스트 초기화)
2. `/mcpsi-implementation Phase 1` 호출
3. Phase 1 입력 흐름:
   - 기존 오픈 이슈 6개(#6 댓글, #7 답글, #11 중복요청, #34, #70, #73 등)에 대한 Phase 1 흡수/재정비 판단
   - Solution Phase 1 결정(application-arch.md §Phase 1 + data-design.md §Phase 1 + security.md §2/§5/§7/§8)에 따른 신규 이슈 분해
4. Phase 1의 첫 작업은 Phase 0에서 활성화된 migrations 인프라 위에서 데이터 보존형 마이그레이션 스크립트 작성 (user 테이블 신설 → user_auth 재구성 → user_auth_provider 신설 → user_info 외래키 변경 → post/post_like 외래키 변경 → 인덱스 추가 → comment/reply 신설 — data-design.md §Phase 1의 7단계 순서)

### 본 plan의 Phase 1 시점 갱신 의무 (verify warn 처리)

Phase 1 분해(`/mcpsi-implementation Phase 1` 첫 분석) 직후, Phase 1 마일스톤 신설 + 이슈 번호 확정 시점에 본 `issue-plan.md`의 다음 항목을 갱신해야 한다:

- `#79 (TypeORM migrations 활성화)`의 `blocks` 라인의 `Phase 1 마일스톤 전체 이슈군` 표기를 Phase 1에서 실제 생성된 구체 이슈 번호 목록으로 치환
  - 예: `blocks: #100, #101, #102, #103 — 사유: ...` (Phase 1 데이터 마이그레이션 7단계 이슈 + 외래키 변경 이슈군)
- 갱신 시점: Phase 1 마일스톤의 모든 이슈가 GitHub에 생성된 직후 (Phase 1 issue-plan.md 작성 단계와 동일 세션)
- 갱신 책임: Phase 1 mcpsi-implementation 호출 시 본 갱신을 함께 수행
- 갱신 근거: methodology-issue-contract-planning.md §5 blocks 점검 (a) 타겟 실존 — 미래 이슈군 표기는 임시 허용이나 Phase 분해 후 구체 식별자 치환이 원칙
