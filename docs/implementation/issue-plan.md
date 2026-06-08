---
next-task-policy: small-first
workers: 1
assignees: [@dev-msj]
created-at: 2026-04-25
last-rebalanced-at: 2026-05-12 — Phase 1 이슈 단위 재설계 (빌드 일관성 + 크기 가이드 + 단일 관심사 원칙. Migration+Entity 통합 + IDOR Service 레이어 도메인 내장. 21건 → 22건. #70/#73 본체 흡수)
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
  coord: #86 — 같은 redisConfig 영역
- #89 [버그, contract-impact: none] 전역 ValidationPipe가 사용자 파이프 전 path 파라미터를 NaN으로 변환하여 PK 복호화 실패 [closed]
  provides: 없음 (5개 엔드포인트의 내부 동작 결함 수정)
  consumes: 없음
- #86 [리팩토링, contract-impact: breaking] RedisHealthIndicator를 ioredis 인스턴스 직접 inject 구조로 리팩토링 [closed]
  provides: 단일 ioredis Provider (REDIS_CLIENT), RedisHealthIndicator의 driver-agnostic 설계
  consumes: 없음
- #79 [리팩토링, 인프라, 데이터, 조립 레이어, ← #77] TypeORM migrations 활성화 + InitialSchema export [closed]
  provides: migration 인프라 (synchronize:false, src/migrations/, npm scripts, data-source.ts, global-setup.ts, InitialSchema)
  consumes: HealthModule 자기완결성 (← #77)
  blocks: Phase 1 마일스톤 전체 이슈군 — 사유: User Aggregate 재설계 데이터 보존형 마이그레이션의 선행 인프라. Phase 1 §X1~Z1이 본 blocks 치환

## Phase 1 — 기능 완성 + 도메인 재정비
근거: problem.md §Phase 근거 (Phase 1) — BP3 + TP3·TP4·TP5 + 보안 강화. Refactoring Towards Patterns [확정] — 중간 단계(외래키 BIGINT 마이그레이션) 앞쪽 + 목표 패턴(Identity Separation + Account Linking) 뒤쪽.

### 모노 트랙

- #61 [문서, 테스트] 단순 Provider 단위 테스트 패턴 컨벤션 정의 (흡수, testing-strategy.md §8 명문화) [closed]
  provides: testing-strategy.md §8 컨벤션 명문화 (docs/tech-notes 또는 CLAUDE.md §테스트 패턴)
  consumes: 없음
  coord: #118, #120, #121, #122, #124, #125, #126, #128, #129, #130, #131 — 신규 단위 테스트 작성 영역의 컨벤션 선행

- #133 [보안, 인프라] V1: @nestjs/throttler + 전역 ThrottlerGuard + Tracker 오버라이드 + COMMON_TOO_MANY_REQUESTS [closed]
  provides: ThrottlerGuard 전역, COMMON_TOO_MANY_REQUESTS ErrorCode (90008), Redis storage driver 결정 (라이브러리 평가 블로커)
  consumes: 없음 (REDIS_CLIENT — ← #86)

- #132 [기능] T1: IdempotencyKeyInterceptor + IdempotencyService + @SkipIdempotency + IDEMPOTENCY_IN_PROGRESS ErrorCode
  provides: IdempotencyKeyInterceptor (전역 APP_INTERCEPTOR), IdempotencyService, @SkipIdempotency() 데코레이터, IDEMPOTENCY_IN_PROGRESS ErrorCode (90009)
  consumes: 없음 (REDIS_CLIENT — ← #86)
  coord: #129, #130, #131 (login/refresh/oauth @SkipIdempotency), #121, #122, #124, #125, #126 (Write API 자동 적용)

- #117 [기능, 데이터] X1: user 테이블 신설 + UserEntity 신설
  provides: user 테이블 (BIGINT user_id PK), UserEntity, UserModule registerEntities
  consumes: migration 인프라 (← #79)

- #119 [리팩토링, 데이터] X3: user_info migration + Entity + Repository find 키 변경
  provides: user_info.user_id BIGINT PK FK, UserInfoEntity, UserInfoRepository (user_id 기반)
  consumes: user 테이블 (← #117)

- #118 [리팩토링, 데이터] X2: user_auth migration + Entity + Repository find 키 변경 + login_id UNIQUE
  provides: user_auth.user_id BIGINT PK FK, login_id VARCHAR(100) NULL UNIQUE, socialYN 폐기, UserAuthEntity, UserAuthRepository (user_id/login_id 기반)
  consumes: user 테이블 (← #117)

- #120 [기능, 데이터] X4: user_auth_provider 신설 + Entity + Repository + OAuth 사용자 매핑
  provides: user_auth_provider 테이블, (provider, provider_subject) UNIQUE INV-AP1, UserAuthProviderEntity, UserAuthProviderRepository (findByProviderSubject, findUserIdByEmail, insert), 기존 OAuth 사용자 매핑
  consumes: user 테이블 (← #117), user_auth login_id NULL 마킹 (← #118)

- #121 [리팩토링, 보안, 데이터] Y1: post migration + PostEntity 외래키 + PostRepository + IDOR Service 레이어
  provides: post.user_id BIGINT FK CASCADE, PostEntity user_id, PostRepository (updateByIdAndOwner/deleteByIdAndOwner WHERE 절 IDOR), PostService IDOR 강제 (404 정책)
  consumes: user 테이블 (← #117), user_auth.user_id (← #118)

- #122 [리팩토링, 보안, 데이터] Y2: post_like migration + Entity + Repository + IDOR + 예외 컨텍스트 (#73 본체 흡수)
  provides: post_like.user_id BIGINT 복합 PK (post_id, user_id), PostLikeEntity, PostLikeRepository (UNIQUE/FK 충돌 catch, DELETE WHERE IDOR), PostLikeAlreadyExists/NotFound 예외 {uid, postId} 컨텍스트
  consumes: user 테이블 (← #117), user_auth.user_id (← #118)
  coord: #73 — 본 이슈가 #73 본체 흡수

- #124 [기능, 데이터] Z1: comment / reply 테이블 신설 migration
  provides: comment 테이블 + idx_comment_post_cursor, reply 테이블 + idx_reply_comment (Adjacency List 깊이 1), FK CASCADE
  consumes: user 테이블 (← #117), post 테이블 (← #121)

- #128 [리팩토링, 보안] U1: AuthGuard sub BIGINT 변환 + JwtService.verifyRefreshToken throw 통일 (#70 본체 흡수)
  provides: AuthGuard payload.sub BIGINT parseInt, JwtService.verifyRefreshToken throw 시그니처, @AuthenticatedUserValidation() BIGINT
  consumes: UserAuthEntity user_id (← #118)
  coord: #70 — 본 이슈가 #70 본체 흡수

- #129 [리팩토링] U2: user-auth.service.join/login user_id 기반 재작성 (QueryRunner 트랜잭션)
  provides: UserAuthService.join (user→user_auth→user_info 3 INSERT 트랜잭션), UserAuthService.login (sub=user_id BIGINT)
  consumes: UserEntity (← #117), UserAuthEntity (← #118), UserInfoEntity (← #119), AuthGuard sub 변환 (← #128)

- #130 [리팩토링, 보안] U3: user-auth.service.refresh QueryRunner 트랜잭션 (Rotation 원자성)
  provides: UserAuthService.refresh (DT-2 R5·R6 분기, INV-11 원자성), UserAuthRepository.updateRefreshToken with qr
  consumes: UserAuthEntity user_id (← #118), JwtService.verifyRefreshToken throw (← #128)
  coord: #128 — 같은 인증 흐름 영역

- #131 [기능] U4: user-auth.service.oauth Account Linking 재작성 + nickname-derivation
  provides: UserAuthService.oauthLogin (Identity Separation + Account Linking 분기 합류), nickname-derivation utility
  consumes: user_auth_provider 테이블 (← #120), UserAuthProviderRepository (← #120), AuthGuard sub (← #128)

- #135 [보안] V3: 로그인 실패 카운트 + 계정 잠금 (Redis 카운터)
  provides: login_fail:{loginId} Redis 카운터 (TTL 15분 / 5회 잠금), AuthInvalidPasswordException 통합 처리 (선택지 2)
  consumes: UserAuthService.login (← #129)
  coord: #129 — 같은 login 메소드 영역

- #123 [기능, 데이터] Y3: post 커서 페이징 인덱스 + CursorPaginationDto + cursor utility + PostService.list
  provides: idx_post_cursor, idx_post_user, CursorPaginationDto, cursor utility (encode/decode), PostService.list/listByUser cursor 기반
  consumes: post 테이블 (← #121), PostEntity user_id (← #121)

- #137 [기능] Y4: post 상세조회 — PostService.findOne (hits++ + liked_by_me/like_count 집계)
  provides: PostService.findOne (hits++/liked_by_me/like_count), GET /posts/:postId 핸들러, blog-post-read-detail flow 구현 (UC-5 커버)
  consumes: PostEntity/PostRepository (← #121), PostLikeRepository (← #122)
  coord: #123 — 같은 PostService 영역

- #125 [기능, 보안] Z2: Comment 모듈 신설 (Entity + Repository + Service + Controller + DTO + IDOR + Exception)
  provides: Comment 모듈 (controller/service/repository/dao/entities/dto), CommentNotFoundException {uid, commentId} 컨텍스트, COMMENT_NOT_FOUND ErrorCode (32001), Comment CRUD + IDOR
  consumes: comment 테이블 (← #124), PostEntity user_id (← #121)

- #126 [기능, 보안] Z3: Reply 모듈 신설 (Adjacency List 깊이 1, Entity + Repository + Service + Controller + DTO + IDOR + Exception)
  provides: Reply 모듈, ReplyNotFoundException {uid, replyId} 컨텍스트, REPLY_NOT_FOUND ErrorCode (32002), Reply CRUD + 깊이 1 강제 (라우팅 부재)
  consumes: reply 테이블 (← #124), Comment 모듈 (← #125)

- #127 [기능] Z4: Comment 커서 페이징 조회 + Reply 전체 조회 응답
  provides: CommentService.list (cursor ASC), ReplyService.listByComment (페이징 없음), Controller GET 핸들러
  consumes: Comment 모듈 (← #125), Reply 모듈 (← #126), cursor utility (← #123)

- #134 [보안] V2: 경로별 @Throttle() 데코레이터 적용
  provides: 6 경로 그룹 Rate Limit 정책 적용 (security.md §5.2 표)
  consumes: ThrottlerGuard 전역 (← #133)
  coord: #129, #130, #131, #121, #122, #125, #126 — Throttle 데코레이터 부착 영역

- #136 [보안] W1: IDOR 방어 E2E 통합 회귀 (Post/PostLike/Comment/Reply, STRIDE-4 / STRIDE-11)
  provides: 없음 (E2E 통합 검증)
  consumes: Post IDOR (← #121), PostLike IDOR (← #122), Comment IDOR (← #125), Reply IDOR (← #126)

- #69 [리팩토링] BaseException 하위 클래스 통합 검토 (흡수, implementation-guide.md §9.2 검토 결과 명문화)
  provides: implementation-guide.md §9.2 명문화 (Phase 1 통합 보류 결정)
  consumes: 없음
  coord: #125, #126, #122 — 신규 도메인 예외 추가 영역

- #70 [리팩토링] verifyRefreshToken throw 통일 (흡수, 본체 #128에서 수행)
  provides: 없음 (작업 본체 #128, 본 이슈는 흡수 마커)
  consumes: 없음
  coord: #128 — 본 이슈 작업이 #128에 흡수 (U1 PR 머지 시 본 이슈도 close)

- #73 [리팩토링] PostLike 예외 컨텍스트 (흡수, 본체 #122에서 수행)
  provides: 없음 (작업 본체 #122, 본 이슈는 흡수 마커)
  consumes: 없음
  coord: #122 — 본 이슈 작업이 #122에 흡수 (Y2 PR 머지 시 본 이슈도 close)

### 추가 이슈 인덱스 (참고)
- #85 — Phase 0 / 모노 트랙 추가 (#77 PR #83 1차 리뷰에서 생성, contract-impact: additive)
- #86 — Phase 0 / 모노 트랙 추가 (#77 PR #83 2차 리뷰에서 생성, contract-impact: breaking)
- #89 — Phase 0 / 모노 트랙 추가 (#85 PR #87 1차 리뷰에서 생성, contract-impact: none)
- #61 — Phase 1 / 모노 트랙 흡수 (Phase 1 진입 분석 2026-05-12)
- #69 — Phase 1 / 모노 트랙 흡수 (Phase 1 진입 분석 2026-05-12)
- #70 — Phase 1 / 모노 트랙 흡수 본체 #128 (Phase 1 진입 분석 2026-05-12 + 이슈 단위 재설계)
- #73 — Phase 1 / 모노 트랙 흡수 본체 #122 (Phase 1 진입 분석 2026-05-12 + 이슈 단위 재설계)
- #117~#136 — Phase 1 / 모노 트랙 (Phase 1 이슈 단위 재설계 2026-05-12, 이전 #96~#116 21건 close + 신규 22건 생성)
- #137 — Phase 1 / 모노 트랙 (UC-5 커버리지 공백 보정, 2026-06-05 mcpsi-implementation-verify 검증 4 Major 후속. blog-post-read-detail flow 구현 이슈)

### 분류 인덱스 (참고)
- 기능: #78, #117, #119(공동 리팩토링), #120, #124, #125, #126, #127, #131, #132, #137
- 버그: #77, #89
- 리팩토링: #75, #76, #79, #85, #86, #118, #121, #122, #128, #129, #130, #69, #70, #73
- 인프라: #75, #79, #133
- 데이터: #79, #117, #118, #119, #120, #121, #122, #123, #124
- 보안: #78, #121, #122, #125, #126, #128, #130, #133, #134, #135, #136
- 문서: #61
- 테스트: #61
- 조립 레이어: #79
