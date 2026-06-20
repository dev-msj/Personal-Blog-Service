---
next-task-policy: small-first
workers: 1
assignees: [@dev-msj]
created-at: 2026-04-25
last-rebalanced-at: 2026-05-12 — Phase 1 이슈 단위 재설계 (빌드 일관성 + 크기 가이드 + 단일 관심사 원칙. Migration+Entity 통합 + IDOR Service 레이어 도메인 내장. 21건 → 22건. #70/#73 본체 흡수)
last-updated-at: 2026-06-11 — 절차 개선 3건 반영 (migration 라인 #117~#131 parallel-change 단계 메타 + E2E 검증 이슈군 #142~#153 신설). 기존 이슈 순서·트랙 불변
last-updated-at: 2026-06-11 — #118 Parallel Change 재분할 (그린 게이트 보존): #118 expand(컬럼 추가) + #154 contract(uid/socialYN 제거) 분리, #128~#131 contract→migrate 재태깅. #118 단독 머지 시 미전환 UserAuthService/AuthGuard 컴파일 불가 해소
last-updated-at: 2026-06-11 — #119 Parallel Change 재분할: #119 expand + #155 contract(소비자 UserInfoService 전환 + uid 제거 원자 결합). 기존 plan 갭(UserInfoService user_id migrate 이슈 부재) 해소. #154 consumes user_info ←#119에서 ←#155로 정정(FK 참조 전환 출처)
last-rebalanced-at: 2026-06-20 — #134 coord→consumes 승격 (work-parallel 웨이브 1 병렬 분석 적발: @Throttle 부착 라우트 #129/#130/#131/#121/#122/#125/#126/#155가 hard 선행인데 coord로 과소 모델링되어 frontier가 미구현 라우트에 #134를 진입시켰음). #117·#132 closed 표시 (웨이브 1 머지)
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

- #132 [기능] T1: IdempotencyKeyInterceptor + IdempotencyService + @SkipIdempotency + IDEMPOTENCY_IN_PROGRESS ErrorCode [closed]
  provides: IdempotencyKeyInterceptor (전역 APP_INTERCEPTOR), IdempotencyService, @SkipIdempotency() 데코레이터, IDEMPOTENCY_IN_PROGRESS ErrorCode (90009)
  consumes: 없음 (REDIS_CLIENT — ← #86)
  coord: #129, #130, #131 (login/refresh/oauth @SkipIdempotency), #121, #122, #124, #125, #126 (Write API 자동 적용)

- #117 [기능, 데이터] X1: user 테이블 신설 + UserEntity 신설 [closed]
  provides: user 테이블 (BIGINT user_id PK), UserEntity, UserModule registerEntities
  consumes: migration 인프라 (← #79)
  migration: parallel-change/expand

- #119 [리팩토링, 데이터] X3 expand: user_info user_id 컬럼 추가 + backfill (Parallel Change expand)
  provides: user_info.user_id 컬럼(nullable, backfill 완료), UserInfoEntity userId 필드, UserInfoRepository findByUserId, UserInfoService.getUserInfoByUserId (신규 — post_like 등 교차 서비스 소비자의 user_id 전환용. 기존 uid PK·관계·메서드·getUserInfoByUid 보존)
  consumes: user 테이블 (← #117)
  migration: parallel-change/expand

- #118 [리팩토링, 데이터] X2 expand: user_auth user_id/login_id 컬럼 추가 + backfill (Parallel Change expand)
  provides: user_auth.user_id/login_id 컬럼(nullable, backfill 완료), UserAuthEntity userId/loginId 필드, UserAuthRepository findByUserId/findByLoginId (기존 uid PK·socialYN·uid 메서드 보존)
  consumes: user 테이블 (← #117)
  migration: parallel-change/expand

- #120 [기능, 데이터] X4: user_auth_provider 신설 + Entity + Repository + OAuth 사용자 매핑
  provides: user_auth_provider 테이블, (provider, provider_subject) UNIQUE INV-AP1, UserAuthProviderEntity, UserAuthProviderRepository (findByProviderSubject, findUserIdByEmail, insert), 기존 OAuth 사용자 매핑
  consumes: user 테이블 (← #117), user_auth login_id NULL 마킹 (← #118)
  migration: parallel-change/migrate

- #121 [리팩토링, 보안, 데이터] Y1: post migration + PostEntity 외래키 + PostRepository + IDOR Service 레이어 (통합 원자 — migrate+contract 결합)
  provides: post.user_id BIGINT FK CASCADE, PostEntity user_id(@ManyToOne→User), PostRepository (updateByIdAndOwner/deleteByIdAndOwner WHERE 절 IDOR), PostService IDOR 강제 (404 정책), UserAuthEntity.@OneToMany(PostEntity) 역관계 제거(그린 게이트)
  consumes: user 테이블 (← #117), user_auth.user_id (← #118), 인증 user_id 식별자 (← #128) — PostService IDOR(Post.user_id === authUserId) 및 controller authUid 시그니처가 user_id 전제, UserAuthService.join user_id 생성 (← #129) — PR 테스트 셋업에서 join 엔드포인트로 생성한 사용자에 user_id 보장 필요
  migration: parallel-change/migrate
  note: 단일 원자 PR. post_uid 제거가 user 모듈(UserAuthEntity 역관계)·cache-id.utils를 깨뜨리므로 해당 정리를 같은 PR에 포함해야 그린 — testing-strategy.md §13

- #122 [리팩토링, 보안, 데이터] Y2: post_like migration + Entity + Repository + IDOR + 예외 컨텍스트 (#73 본체 흡수)
  provides: post_like.user_id BIGINT 복합 PK (post_id, user_id), PostLikeEntity(@ManyToOne→User), PostLikeRepository (UNIQUE/FK 충돌 catch, DELETE WHERE IDOR), PostLikeAlreadyExists/NotFound 예외 {userId, postId} 컨텍스트, UserAuthEntity.@OneToMany(PostLikeEntity) 역관계 제거(그린 게이트)
  consumes: user 테이블 (← #117), user_auth.user_id (← #118), UserInfoService.getUserInfoByUserId (← #119) — post-like.service 닉네임 조회 user_id 전환, 인증 user_id 식별자 (← #128) — IDOR 및 controller authUid 시그니처, UserAuthService.join user_id 생성 (← #129) — PR 테스트 셋업 user_id 보장
  coord: #73 — 본 이슈가 #73 본체 흡수
  migration: parallel-change/migrate
  note: 단일 원자 PR. post_like.uid 제거가 UserAuthEntity 역관계·post-like.service의 getUserInfoByUid 호출을 깨뜨리므로 역관계 제거 + getUserInfoByUserId 전환을 같은 PR에 포함 — testing-strategy.md §13

- #124 [기능, 데이터] Z1: comment / reply 테이블 신설 migration
  provides: comment 테이블 + idx_comment_post_cursor, reply 테이블 + idx_reply_comment (Adjacency List 깊이 1), FK CASCADE
  consumes: user 테이블 (← #117), post 테이블 (← #121)

- #128 [리팩토링, 보안] U1: AuthGuard sub BIGINT 변환 + JwtService.verifyRefreshToken throw 통일 (#70 본체 흡수)
  provides: AuthGuard payload.sub BIGINT parseInt, JwtService.verifyRefreshToken throw 시그니처, authenticatedUserId 헤더 신설(user_id string) + authenticatedUser(uid) 헤더 전환기 병존 유지, @AuthUserId() 데코레이터 신설(number 반환)
  consumes: UserAuthEntity user_id (← #118)
  coord: #70 — 본 이슈가 #70 본체 흡수
  migration: parallel-change/migrate
  note: 전략 C 확정. (A) string 유지 기각: 서비스 findByUid("123") → E2E 런타임 실패. (B) number 즉시 기각: TypeScript가 createParamDecorator 반환 타입 ≠ 파라미터 어노테이션 불일치 미검사 → 컴파일 게이트 없음, #128+#121+#122+#155 원자 웨이브 필요 → plan PR 경계 파괴. (C) 가드 두 헤더 병존 + @AuthUserId 신설: 컨트롤러 PR별 독립 이전, #154 contract에서 uid 헤더·@AuthenticatedUserValidation 일괄 제거. testing-strategy.md §13

- #129 [리팩토링] U2: user-auth.service.join/login user_id 기반 재작성 (QueryRunner 트랜잭션)
  provides: UserAuthService.join (user→user_auth→user_info 3 INSERT 트랜잭션), UserAuthService.login (sub=user_id BIGINT)
  consumes: UserEntity (← #117), UserAuthEntity (← #118), UserInfoEntity (← #119), AuthGuard sub 변환 (← #128)
  migration: parallel-change/migrate

- #130 [리팩토링, 보안] U3: user-auth.service.refresh QueryRunner 트랜잭션 (Rotation 원자성)
  provides: UserAuthService.refresh (DT-2 R5·R6 분기, INV-11 원자성), UserAuthRepository.updateRefreshToken with qr
  consumes: UserAuthEntity user_id (← #118), JwtService.verifyRefreshToken throw (← #128)
  coord: #128 — 같은 인증 흐름 영역
  migration: parallel-change/migrate

- #131 [기능] U4: user-auth.service.oauth Account Linking 재작성 + nickname-derivation
  provides: UserAuthService.oauthLogin (Identity Separation + Account Linking 분기 합류), nickname-derivation utility
  consumes: user_auth_provider 테이블 (← #120), UserAuthProviderRepository (← #120), AuthGuard sub (← #128)
  migration: parallel-change/migrate

- #154 [리팩토링, 보안, 데이터] X2 contract: user_auth uid/socialYN 제거 + user_id PK 승격 (Parallel Change contract)
  provides: user_auth 최종 스키마 (user_id PK, uid·socialYN 제거, login_id UNIQUE, FK CASCADE), UserAuthEntity/Repository uid 경로 제거, @AuthenticatedUserValidation 데코레이터 제거, AuthGuard authenticatedUser(uid) 헤더 병존 주입 제거
  consumes: user_auth user_id 컬럼 (← #118), AuthGuard user_id 전환 (← #128), UserAuthService join/login (← #129), refresh (← #130), oauth (← #131), user_auth_provider (← #120), user_info user_id 전환 (← #155), post user_id (← #121), post_like user_id (← #122)
  migration: parallel-change/contract

- #155 [리팩토링, 보안, 데이터] X3 contract: user_info user_id 전환 + uid 제거 (Parallel Change contract, 소비자 migrate 결합)
  provides: user_info 최종 스키마 (user_id PK, uid 제거, FK user.user_id), UserInfoService/Controller/Entity user_id 전환, getUserInfoByUid 제거
  consumes: user_info user_id 컬럼 (← #119), AuthGuard BIGINT 식별자 (← #128), post-like.service getUserInfoByUid 전환 완료 (← #122) — getUserInfoByUid 제거 전 전 호출자 이전 필요, UserAuthService.join user_id 생성 (← #129) — PR 테스트 셋업 user_id 보장
  migration: parallel-change/contract

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
  consumes: ThrottlerGuard 전역 (← #133), auth 컨트롤러 엔드포인트 login/refresh/oauth (← #129, #130, #131), post/post_like 컨트롤러 (← #121, #122), comment/reply 컨트롤러 (← #125, #126), user_info 컨트롤러 user_id 전환 (← #155)
  note: 데코레이터 부착 대상 라우트가 존재해야 작업 가능(이슈 본문 "선행: V1 + 모든 컨트롤러"). 2026-06-20 재정렬에서 coord(soft) → consumes(hard) 승격 — coord 표기는 frontier가 미구현 라우트에 #134를 잘못 진입시켰음(병렬 분석 적발)

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

E2E 검증 이슈군 (수동 QA 대체, UC 단위). consumes로 CPM 위상 정렬이 각 UC 구현 완료 직후 Wave에 배치한다. #142가 E2E 하네스를 provides하고 나머지가 consumes한다. testing-strategy.md §6 기존 E2E TC를 UC 단위 실행 검증으로 묶으며 §2 Pyramid 합계는 불변. GWT 서술형 + docs/qa/e2e-catalog.md 게시.

- #142 [E2E 검증] UC-1: 회원가입 (+ E2E 하네스 셋업)
  provides: E2E 하네스 (DbCleaner Tables 확장 + FK 역순, AuthHelper user_id 기반, UserFactory/OAuthUserFactory/PostFactory/CommentFactory/ReplyFactory)
  consumes: user 테이블 (← #117), user_auth (← #118), user_info (← #119), UserAuthService.join (← #129), IdempotencyKeyInterceptor (← #132)
- #143 [E2E 검증] UC-2: 로그인
  provides: 없음
  consumes: user_auth (← #118), AuthGuard sub (← #128), UserAuthService.login (← #129), 로그인 실패 잠금 (← #135), E2E 하네스 (← #142)
- #144 [E2E 검증] UC-3-signup: Google OAuth 신규 자동가입 + 검증 실패
  provides: 없음
  consumes: user 테이블 (← #117), user_auth_provider (← #120), AuthGuard sub (← #128), UserAuthService.oauthLogin (← #131), E2E 하네스 (← #142)
- #145 [E2E 검증] UC-3-linking: Google OAuth Account Linking + 기존 OAuth 재로그인
  provides: 없음
  consumes: user 테이블 (← #117), user_auth_provider (← #120), AuthGuard sub (← #128), UserAuthService.oauthLogin (← #131), E2E 하네스 (← #142)
- #146 [E2E 검증] UC-4: 토큰 갱신 (Refresh Token Rotation)
  provides: 없음
  consumes: user_auth (← #118), AuthGuard sub (← #128), UserAuthService.refresh (← #130), E2E 하네스 (← #142)
- #147 [E2E 검증] UC-5: 글 상세 조회 (hits 증가)
  provides: 없음
  consumes: PostService IDOR (← #121), PostLikeRepository (← #122), PostService.findOne (← #137), E2E 하네스 (← #142)
- #148 [E2E 검증] UC-6: 좋아요 추가/취소
  provides: 없음
  consumes: post_like 복합 PK/Repository (← #122), IdempotencyKeyInterceptor (← #132), E2E 하네스 (← #142)
- #149 [E2E 검증] UC-7: 글 목록 조회 (커서 페이징)
  provides: 없음
  consumes: PostEntity user_id (← #121), CursorPaginationDto/PostService.list (← #123), E2E 하네스 (← #142)
- #150 [E2E 검증] UC-8-create: 댓글 작성
  provides: 없음
  consumes: comment 테이블 (← #124), post FK (← #121), Comment 모듈 (← #125), IdempotencyKeyInterceptor (← #132), E2E 하네스 (← #142)
- #151 [E2E 검증] UC-8-modify: 댓글 수정/삭제 (IDOR)
  provides: 없음
  consumes: Comment 모듈 IDOR (← #125), E2E 하네스 (← #142)
  coord: #136 — IDOR 횡단 회귀 책임 분리 (중복 TC 금지, #136 TC cross-link)
- #152 [E2E 검증] UC-9-create: 답글 작성 (깊이 1)
  provides: 없음
  consumes: reply 테이블 (← #124), Comment 모듈 (← #125), Reply 모듈 (← #126), IdempotencyKeyInterceptor (← #132), E2E 하네스 (← #142)
- #153 [E2E 검증] UC-9-modify: 답글 수정/삭제 (IDOR)
  provides: 없음
  consumes: Reply 모듈 IDOR (← #126), E2E 하네스 (← #142)
  coord: #136 — IDOR 횡단 회귀 책임 분리 (중복 TC 금지, #136 TC cross-link)

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
- #142~#153 — Phase 1 / 모노 트랙 E2E 검증 이슈군 (2026-06-11 절차 개선 반영: QA 대체 E2E 검증 이슈 도입. UC-1~9, UC-3/8/9는 variant 분할)
- #154 — Phase 1 / 모노 트랙 (2026-06-11 #118 Parallel Change 재분할: #118 expand(컬럼 추가) + #154 contract(uid/socialYN 제거). #118 단독 머지 시 미전환 Service/AuthGuard 컴파일 불가 → 그린 게이트 보존 위해 분리. #128~#131 contract→migrate 재태깅)
- #155 — Phase 1 / 모노 트랙 (2026-06-11 #119 Parallel Change 재분할: #119 expand(컬럼 추가) + #155 contract(소비자 UserInfoService 전환 + uid 제거 원자 결합). #119 단독 머지 시 미전환 UserInfoService 컴파일 불가 → 분리. user_info 소비자 단일 로커스라 migrate+contract 결합)

### 분류 인덱스 (참고)
- 기능: #78, #117, #119(공동 리팩토링), #120, #124, #125, #126, #127, #131, #132, #137
- 버그: #77, #89
- 리팩토링: #75, #76, #79, #85, #86, #118, #121, #122, #128, #129, #130, #154, #155, #69, #70, #73
- 인프라: #75, #79, #133
- 데이터: #79, #117, #118, #119, #120, #121, #122, #123, #124, #154, #155
- 보안: #78, #121, #122, #125, #126, #128, #130, #133, #134, #135, #136, #154, #155
- 문서: #61
- 테스트: #61
- E2E 검증: #142, #143, #144, #145, #146, #147, #148, #149, #150, #151, #152, #153
- 조립 레이어: #79
