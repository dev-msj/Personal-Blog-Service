---
next-task-policy: small-first
workers: 1
assignees: [@dev-msj]
created-at: 2026-04-25
last-rebalanced-at: 2026-04-29 — #86 영역 정합 재검사 (Phase 5 deferred → Phase 0 통합)
---

# Issue Plan

## Phase 0 — 기반 확보
근거: problem.md §Phase 근거 (Phase 0)

### 모노 트랙
- #75 [리팩토링, 인프라] Node.js 22.x LTS 버전 일관 선언 [closed]
  provides: Node.js 22.x 환경 표준 (.nvmrc, package.json engines, GitHub Actions setup-node)
  consumes: 없음
- #76 [리팩토링] 미사용 redis 의존성 제거 [closed]
  provides: redis 패키지 제거
  consumes: 없음
- #78 [기능, 보안] gitleaks pre-commit 훅 추가 [closed]
  provides: 시크릿 노출 방지 훅
  consumes: 없음
- #77 [버그] E2E HealthModule CACHE_MANAGER 의존성 해결 (#67 흡수) [closed]
  provides: HealthModule 자기완결성 (CacheModule.registerAsync 내장 import)
  consumes: 없음
- #85 [리팩토링] redisConfig.ts의 isGlobal 옵션을 CacheModuleAsyncOptions 최상위로 이동
  provides: redisConfig.isGlobal이 CacheModuleAsyncOptions 최상위에서 동작
  consumes: 없음
  coord: #86 — 같은 redisConfig 영역. #86 ioredis Provider 단일화가 #85 의도(글로벌 등록 활성화)를 자연스럽게 흡수할 가능성
- #86 [리팩토링, contract-impact: breaking] RedisHealthIndicator를 ioredis 인스턴스 직접 inject 구조로 리팩토링
  provides: 단일 ioredis Provider, RedisHealthIndicator의 driver-agnostic 설계, AppModule 트리에서도 통합 spec 통과
  consumes: 없음
  coord: #85 — 같은 redisConfig 영역. #86이 #85 의도를 자연스럽게 흡수할 가능성
- #79 [리팩토링, 인프라, 데이터, 조립 레이어, ← #77] TypeORM migrations 활성화 + InitialSchema export
  provides: migration 인프라 (synchronize:false, migrations/ 활성, npm scripts 5종, src/config/data-source.ts, test/global-setup.ts, migrations/{timestamp}-InitialSchema.ts)
  consumes: HealthModule 자기완결성 (← #77)
  blocks: Phase 1 마일스톤 전체 이슈군 — 사유: User Aggregate 재설계 데이터 보존형 마이그레이션의 선행 인프라. Phase 1 분해 시 구체 이슈 번호로 치환 의무

### 추가 이슈 인덱스 (참고)
- #85 — Phase 0 / 모노 트랙 추가 (#77 PR #83 1차 리뷰에서 생성, contract-impact: additive)
- #86 — Phase 0 / 모노 트랙 추가 (#77 PR #83 2차 리뷰에서 생성, contract-impact: breaking)

### 분류 인덱스 (참고)
- 기능: #78
- 버그: #77
- 리팩토링: #75, #76, #79, #85, #86
- 인프라: #75, #79
- 데이터: #79
- 보안: #78
- 조립 레이어: #79
