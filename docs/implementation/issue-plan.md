---
next-task-policy: small-first
workers: 1
assignees: [@dev-msj]
created-at: 2026-04-25
last-rebalanced-at: 2026-04-29 — #89 Phase 0 통합 (Phase 0가 "Phase 1 진입 게이트 + 발견된 결함 정리" 역할로 운영되어 #77/#85/#86과 동일 영역 정합)
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
- #85 [리팩토링] redisConfig.ts의 isGlobal 옵션을 CacheModuleAsyncOptions 최상위로 이동 [closed]
  provides: redisConfig.isGlobal이 CacheModuleAsyncOptions 최상위에서 동작
  consumes: 없음
  coord: #86 — 같은 redisConfig 영역. #86 ioredis Provider 단일화가 #85 의도(글로벌 등록 활성화)를 자연스럽게 흡수할 가능성
- #89 [버그, contract-impact: none] 전역 ValidationPipe가 사용자 파이프 전 path 파라미터를 NaN으로 변환하여 PK 복호화 실패
  provides: 없음 (5개 엔드포인트의 내부 동작 결함 수정)
  consumes: 없음
- #86 [리팩토링, contract-impact: breaking] RedisHealthIndicator를 ioredis 인스턴스 직접 inject 구조로 리팩토링 [closed]
  provides: 단일 ioredis Provider, RedisHealthIndicator의 driver-agnostic 설계, AppModule 트리에서도 통합 spec 통과
  consumes: 없음
  coord: #85 — 같은 redisConfig 영역. #86이 #85 의도를 자연스럽게 흡수할 가능성
- #79 [리팩토링, 인프라, 데이터, 조립 레이어, ← #77] TypeORM migrations 활성화 + InitialSchema export
  provides: migration 인프라 (synchronize:false, src/migrations/ 활성, npm scripts 5종, src/config/data-source.ts, test/global-setup.ts, src/migrations/{timestamp}-InitialSchema.ts)
  consumes: HealthModule 자기완결성 (← #77)
  blocks: Phase 1 마일스톤 전체 이슈군 — 사유: User Aggregate 재설계 데이터 보존형 마이그레이션의 선행 인프라. Phase 1 분해 시 구체 이슈 번호로 치환 의무

### 추가 이슈 인덱스 (참고)
- #85 — Phase 0 / 모노 트랙 추가 (#77 PR #83 1차 리뷰에서 생성, contract-impact: additive)
- #86 — Phase 0 / 모노 트랙 추가 (#77 PR #83 2차 리뷰에서 생성, contract-impact: breaking)
- #89 — Phase 0 / 모노 트랙 추가 (#85 PR #87 1차 리뷰에서 생성, contract-impact: none). 사유: Phase 0는 마일스톤 정의상 "Phase 1 진입 게이트 + 발견된 결함 정리" 영역으로 운영되며 #77(E2E HealthModule 결함), #85(redisConfig 정합성), #86(RedisHealthIndicator 리팩토링)이 같은 패턴으로 흡수되어 있다. 5개 production 엔드포인트(post.controller GET/PATCH/DELETE, post-like.controller POST/DELETE)가 깨진 상태에서 Phase 1 신규 기능 회귀 베이스라인 신뢰 불가하므로 Phase 1 진입 전 처리 합당.

### 분류 인덱스 (참고)
- 기능: #78
- 버그: #77, #89
- 리팩토링: #75, #76, #79, #85, #86
- 인프라: #75, #79
- 데이터: #79
- 보안: #78
- 조립 레이어: #79
