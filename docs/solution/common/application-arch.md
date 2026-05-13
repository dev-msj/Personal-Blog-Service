# Application Architecture

## 소유권 경계

이 파일은 **모듈 구조, Aggregate 정의, 채택 패턴**을 다룬다.

- 스키마/DDL/관계 표는 data-design.md 참조
- 비동기 처리 설계(이벤트 계약, Saga, DLQ, 큐 브로커 선정)는 async.md 참조 (async Extension 소관)
- 인증/인가·시크릿·API Idempotency 정책은 security.md 참조 (security Extension 소관)
- 로그·메트릭·트레이싱·Correlation ID 전파 구현은 observability.md 참조 (observability Extension 소관)
- Phase별 모듈 증분 절차는 ../phase-{N}/arch-increment.md 참조

## 모듈 구조 (최종 형상)

```text
src/
├── auth/           # AuthGuard 유지
├── user/           # User Aggregate — UserAuth / UserAuthProvider / UserInfo / JWT / OAuth
├── blog/           # Post Aggregate — Post / PostLike / Comment / Reply
├── observability/  # Phase 2 신설 — Correlation ID Interceptor / AuditLogger + AuditLogRepository / Metrics exporter / Tracing 초기화
│   └── audit/      # AuditLogService (INSERT-only contract) + AuditLogRepository — observability.md §5 정책 primary, data-design.md §audit_log 스키마
├── notification/   # Phase 3 신설 — 알림 비동기 기능
├── health/
├── config/
├── constant/ / decorator/ / filter/ / interceptor/ / pipe/ / exception/ / response/ / utils/
```

각 모듈의 신설/변경 시점:
- user 내부 구조 재편 (UserAuthProvider 신설, userId BIGINT 분리), blog에 Comment/Reply 추가 — Phase 1
- observability/ 모듈 신설 — Phase 2
- notification/ 모듈 신설 — Phase 3

## 의존 방향

```text
notification → (구독) blog, user             // 이벤트 구독
blog, user, auth → observability/audit       // 감사 이벤트 INSERT (도메인 횡단)
blog → user                                   // Post 작성자 확인
auth → user                                   // 인증 시 User 자격 조회
<공통 모듈> ← 모든 feature 모듈
```

observability 모듈 의존 원칙: blog/user/auth가 observability/audit의 AuditLogService를 의존 (단방향). observability는 어떤 도메인 모듈도 의존하지 않음 (도메인 횡단 인프라). Vernon Rule 3 단방향 참조 정합. NestJS Global Module로 등록하여 모든 feature 모듈에서 import 없이 inject 가능하게 구성 (NestJS 공식 Global Module 컨벤션).

### [확정] 모듈 간 의존 제약

결정: 양방향 의존 금지. feature 모듈 간 참조는 단방향 + 이벤트 구독만 허용 [확정]

근거: methodology-ddd.md Vernon Rule 3 (Aggregate 간 참조는 단방향이 기본) + NestJS 공식 모듈 컨벤션 (`exports`/`imports` 명시)

기각 대안: 양방향 참조 허용 — 순환 의존 유발, 테스트 격리 저해, async Extension의 이벤트 기반 해소 원칙과 충돌

파급 효과: notification 모듈이 blog/user 이벤트를 구독하는 구조로 결합 해소. Post 작성자 확인 시 user 모듈의 Provider를 임포트하되 user 모듈에서 blog를 임포트하지 않음.

## Aggregates

### User Aggregate

#### Root 및 구조

```
Aggregate: User
  Invariants:
    - UserAuth.loginId는 전역 유일 (일반 가입 경로)
    - UserAuthProvider의 (provider, providerId) 조합은 전역 유일
    - UserInfo.nickname은 전역 유일
    - RefreshToken Rotation 원자성 (access + refresh 동시 재발급 + DB 저장값 함께 갱신, 부분 성공 금지)
    - 인증 통과 조건: AccessToken 서명/만료 검증 AND RefreshToken DB 저장값 일치 동시 성립
    - 한 User는 일반 가입(UserAuth 1건) 또는 OAuth(UserAuthProvider N건) 또는 둘 다 보유 가능
  내부 Entity/VO:
    - UserAuth: 로그인 자격 (loginId, password, salt, refreshToken, userRole). 카디널리티 User:UserAuth = 1:0..1, 생명주기 dependent, 집합 조회 없음
    - UserAuthProvider: 외부 IdP 매핑 (provider, providerId, email). 카디널리티 User:UserAuthProvider = 1:0..N, 생명주기 dependent, 집합 조회 all (보통 N ≤ 5)
    - UserInfo: 프로필 (nickname, introduce). 카디널리티 User:UserInfo = 1:1, 생명주기 dependent
  외부 참조:
    - 없음 (Aggregate Root)
  주요 Command → Event:
    - RegisterUser(loginId, password) → UserRegistered(userId)
    - LoginUser(loginId, password) → UserLoggedIn(userId) [JWT 발급 부수 효과]
    - LoginOAuth(provider, idToken) → UserLoggedIn(userId) 또는 신규 시 UserRegistered + OAuthProviderLinked
    - LinkOAuthProvider(userId, provider, providerId) → OAuthProviderLinked(userId, provider)
    - RefreshToken → TokenRotated(userId)
    - UpdateUserInfo(userId, nickname, introduce) → UserInfoUpdated(userId)
    - DeleteUser(userId) → UserDeleted(userId) [후속 Post/PostLike cascade]
```

#### Vernon Rule 적용 판단

- Rule 1 (Invariant 트랜잭션 경계): UserAuth / UserAuthProvider / UserInfo 간 트랜잭션 강일관성 필요 — (provider, providerId) UNIQUE 제약이 UserAuthProvider 생성 시 동시 검증되어야 하며, RefreshToken Rotation은 UserAuth 내 원자 갱신. → 동일 Aggregate
- Rule 2 (작은 Aggregate): 내부 Entity 3개 포함. 분리 가능성 검토:
  - UserInfo를 별도 Aggregate로 분리 → nickname UNIQUE 제약 검증이 User와 분리됨. 하지만 UserInfo는 User 생명주기와 일치 (CASCADE)하고 독립 존재 이유 없음 → 내부 Entity 유지
  - UserAuthProvider를 별도 Aggregate로 분리 → (provider, providerId) UNIQUE 제약 검증과 User 생성 트랜잭션을 묶어야 하므로 eventual consistency로 처리하면 복잡. → 내부 Entity 유지
  - "집합체 없이는 의미가 있는가" — UserAuthProvider 단독 존재 무의미, UserInfo 단독 존재 무의미. "생명주기 동일한가" — 모두 User와 함께 생성/삭제
- Rule 3 (단방향 참조): 외부 참조 없음
- Rule 4 (경계 밖 일관성): 다른 Aggregate(Post)에서 User를 참조할 때는 userId로 참조 + 삭제 전파는 이벤트 기반(UserDeleted) 또는 DB-level cascade(학습 프로젝트 단순성 예외)

### Post Aggregate

#### Root 및 구조

```
Aggregate: Post
  Invariants:
    - hits ≥ 0, 단조 증가 (감소 불가)
    - PostLike는 (postId, userId) 쌍당 최대 1건 (스키마 강제 복합 PK)
    - 본인만 수정/삭제 (Post.userId = 인증된 userId)
    - Post 삭제 시 연관된 PostLike / Comment / Reply 모두 함께 삭제
    - Comment 삭제 시 연관된 Reply 모두 함께 삭제
    - Reply의 깊이는 1단계로 제한 (Comment → Reply. Reply → Reply 불가)
  내부 Entity/VO:
    - PostLike: 좋아요 관계 (postId, userId, 복합 PK). 카디널리티 Post:PostLike = 1:0..N, 생명주기 dependent, 집합 조회 subset with pagination (인기 글에서 큰 집합 가능)
    - Comment: 댓글 (commentId, content). 카디널리티 Post:Comment = 1:0..N, 생명주기 dependent, 집합 조회 subset with pagination
    - Reply: 답글 (replyId, commentId, content). 카디널리티 Comment:Reply = 1:0..N, 생명주기 dependent, 집합 조회 all (보통 N 작음)
  외부 참조:
    - User(userId) from Post: 카디널리티 User:Post = 1:N, Post references, ON DELETE cascade (학습 프로젝트 단순성 예외 — Vernon Rule 4의 application-level 기본 원칙 완화)
    - User(userId) from PostLike: 카디널리티 User:PostLike = 1:0..N, references, ON DELETE cascade
    - User(userId) from Comment: 카디널리티 User:Comment = 1:0..N, references, ON DELETE cascade
    - User(userId) from Reply: 카디널리티 User:Reply = 1:0..N, references, ON DELETE cascade
  주요 Command → Event:
    - CreatePost(userId, title, contents) → PostCreated(postId, userId)
    - UpdatePost(postId, userId, title, contents) → PostUpdated(postId) [소유권 검증: Post.userId = 인증된 userId]
    - DeletePost(postId, userId) → PostDeleted(postId)
    - ViewPost(postId) → PostViewed(postId, viewerUserId) [Phase 3: hits 집계 비동기 전환]
    - LikePost(postId, userId) → PostLiked(postId, userId) [Phase 3: 좋아요 집계 캐시 갱신 비동기]
    - UnlikePost(postId, userId) → PostUnliked(postId, userId)
    - CreateComment(postId, userId, content) → CommentCreated(commentId, postId, userId) [Phase 3: 작성자 알림 비동기 발행]
    - UpdateComment(commentId, userId, content) → CommentUpdated(commentId)
    - DeleteComment(commentId, userId) → CommentDeleted(commentId)
    - CreateReply(commentId, userId, content) → ReplyCreated(replyId, commentId, userId) [Phase 3: 댓글 작성자·Post 작성자 알림 비동기 발행]
    - UpdateReply / DeleteReply → ReplyUpdated / ReplyDeleted
```

#### Vernon Rule 적용 판단

- Rule 1: PostLike의 (postId, userId) UNIQUE 제약이 Post 내부에서 검증되어야 하므로 동일 Aggregate
- Rule 2 (작은 Aggregate): 내부 Entity 3개(PostLike / Comment / Reply) 포함. 대규모 검토:
  - Comment를 별도 Aggregate로 분리 가능성 → "댓글 단독 삭제 시 Post 상태 무관" 측면에서는 분리 가능. 그러나 댓글 권한 검증(Post 작성자의 댓글 삭제 권한 같은 향후 기능)이 Post 상태를 참조할 수 있음 + Post 삭제 시 Comment/Reply 함께 삭제가 자연스러움 → 현 단계는 Post 내부 Entity 유지. Comment 양이 매우 커지면 별도 Aggregate 분리 재검토 (후속 Phase 트리거 조건)
  - PostLike도 동일 판단 — 좋아요 카운트는 Post에 표시되는 집계라 Post Aggregate 일부로 간주 자연스러움
- Rule 3: User(userId) 단방향 참조. 생성 순서: User 선행 필수
- Rule 4: User 삭제 시 연쇄 삭제는 DB-level cascade로 구현 (학습 프로젝트 단순성 예외). Aggregate 간 이벤트 기반 삭제 전파는 Phase 3 async Extension에서 재검토 가능

### Cross-Aggregate 이벤트 (async Extension 입력)

async.md에서 이벤트 계약·파티션·순서 보장·DLQ·Idempotency를 상세 설계한다. Core는 이벤트 목록만 정의:

- `UserRegistered(userId, createdAt)` — 환영 처리 등 구독 가능
- `UserLoggedIn(userId, at)` — 로그인 이력 집계 구독 가능
- `OAuthProviderLinked(userId, provider, at)` — 계정 연동 감사 로그 구독 가능
- `TokenRotated(userId, at)` — 보안 이벤트
- `UserInfoUpdated(userId, changedFields)`
- `UserDeleted(userId, at)` — Post/PostLike 정리 구독
- `PostCreated(postId, userId, at)` — 팔로워 알림 등 (향후 트리거)
- `PostUpdated`, `PostDeleted`
- `PostViewed(postId, viewerUserId, at)` — Phase 3: hits 집계 비동기화
- `PostLiked(postId, userId, at)` — Phase 3: 좋아요 집계 캐시 갱신
- `PostUnliked`
- `CommentCreated(commentId, postId, commentAuthorId, postAuthorId, at)` — Phase 3: postAuthor 알림 발행
- `CommentUpdated`, `CommentDeleted`
- `ReplyCreated(replyId, commentId, replyAuthorId, commentAuthorId, postAuthorId, at)` — Phase 3: commentAuthor + postAuthor 알림 발행
- `ReplyUpdated`, `ReplyDeleted`

이벤트 스키마(version, payload 형식), 파티션 키, 순서 보장 요구 범위, DLQ 정책, 중복 검출 메커니즘은 async.md §이벤트 계약 참조.

## 채택 패턴

### [확정] Event-Driven Architecture + Publisher-Subscriber (TP1)

결정: Phase 3에서 EDA 도입. Post 작성/조회/좋아요/댓글/답글 도메인 이벤트를 발행하고, 알림·집계·감사 로그 등 downstream 처리가 구독하는 구조 [확정]

근거: TP1 (BP1 비동기 시스템 적용) + Forces F1(응답성 vs 완결성) / F6(비동기 대상 존재 선행) + Causes of Redesign 4·5·6 (object representation / algorithmic / tight coupling) + Hohpe & Woolf "Enterprise Integration Patterns" (2003) Publish-Subscribe + Richardson "Microservices Patterns" (2018) Event-Driven

기각 대안: (1) 동기 처리 유지 — BP1 학습 목표 미달성. (2) 동기 처리 + 조회수만 비동기 — 부분 도입은 이벤트 계약 일관성 상실, 알림/집계 등 추가 확장 시 재설계 비용. (3) CQRS Event Sourcing — Phase 3 범위 초과(감수 제약), Event Log 저장소와 재구성 로직이 학습 프로젝트 규모 대비 과다

파급 효과: application-arch.md Aggregate Command→Event 매핑이 async Extension 입력. Phase 3 진입 시점에 async Extension이 이벤트 계약(스키마 버전·파티션·순서·Idempotency·DLQ) 상세 설계. observability Extension은 이벤트 흐름 추적을 Correlation ID 전파 설계에 반영. Phase 4 부하 테스트는 비동기 경로 latency 측정을 별도 시나리오로 포함.

### [확정] Identity Separation + Account Linking (TP5)

결정: User Aggregate를 내부 영구 식별자(`userId`)와 로그인 자격(UserAuth) / 외부 IdP 매핑(UserAuthProvider) / 프로필(UserInfo)로 분리. OAuth 로그인 시 email 기반으로 기존 User 탐지하여 동일인 연동 (자동 연결). [확정]

근거: TP5 + Forces(이상적 CI vs 학습 프로젝트 예산) + Causes of Redesign 4 (uid가 loginId + 이메일 혼재) + Smell Oddball Solution + Fowler "Patterns of Enterprise Application Architecture" (2003) Identity Field + 업계 표준 계정 연동(OAuth provider 분리 모델)

기각 대안:
- (1) 현 구조 유지 + 중복 가입 수용 — 동일인 식별 기반 부재, BP3 학습 목표 일부 미달성
- (2) userId 도입 + uid 유지(email 기반 연동 없음) — 식별자 분리는 되나 동일인 식별 목적 미충족
- (3) 명시적 계정 연결 UX (자동 연결 대신 로그인 후 "Google 연결" 버튼) — 실무 보안 기본이나 자동 연결 방식의 탈취 리스크는 후속 과제로 편입
- (4) 유료 본인인증 CI API — 예산 제약으로 불가 (context.md [예산])

파급 효과:
- data-design.md: user / user_auth / user_auth_provider / user_info 4개 테이블 구조. 외래키 전파(post.userId, post_like.userId, comment.userId, reply.userId)로 기존 postUid 네이밍 리팩토링
- security.md (Phase 5): email 기반 자동 연동의 탈취 리스크 → 향후 OAuth `sub` 검증 강화, 이메일 변경 이벤트 처리 전략, 수동 연결 UX 편입 시 영향 기술
- refactor 방향: Refactoring Towards Patterns (아래 §3방향 리팩토링 섹션 참조)
- 외래키 네이밍 리팩토링 절차: ../phase-1/data-migration.md

### [확정] Idempotency Key Pattern (TP3)

결정: 클라이언트 제공 `Idempotency-Key` 헤더 기반 중복 요청 방지. Redis에 요청 키 + 응답 스냅샷 저장. API 수신 측면 [확정]

근거: TP3 + Helland "Idempotence is Not a Medical Condition" (ACM Queue 2012) + Stripe/GitHub 업계 표준 Idempotency-Key 헤더 설계

기각 대안: (1) 무상태 중복 방지(클라이언트 디바운싱) — 네트워크 재시도 시 무력. (2) DB 수준 UNIQUE 제약만 — 상태 변경 연산(좋아요 취소 후 재좋아요) 같은 idempotent 모호 케이스 처리 어려움. (3) 서버 생성 트랜잭션 ID — 클라이언트 재시도 시 새 ID 발급되어 중복 방지 실패

파급 효과:
- API 수신 측면(primary): security.md §Idempotency-Key 헤더 정책 (§6 소유권 매트릭스). 클라이언트 발급 UUID 검증, 응답 캐시 반환 정책, 보존 기간
- 이벤트 수신 측면: async.md §Idempotency (§6 소유권 매트릭스 — 두 측면 분리)
- 스키마 레이어: data-design.md에 Redis 키 설계(외부 저장소는 DDL 개념 없음 — 정책 primary가 키 구조/TTL 기술)
- 적용 범위: Phase 1에서 댓글/답글/좋아요 같은 write 엔드포인트에 도입. 읽기 엔드포인트는 적용 제외

### [확정] Interceptor + AsyncLocalStorage (TP6)

결정: NestJS Global Interceptor에서 요청 진입 시 Correlation ID 생성/추출 + AsyncLocalStorage에 저장. 로그/메트릭/트레이스 전파 주체 [확정]

근거: TP6 + Causes of Redesign 6 (Tight coupling — 로깅이 Winston에만 결합) + AntiPattern Blind Faith (관측 없이 정상성 가정) + Node.js 공식 AsyncLocalStorage (Node 16+) + NestJS 공식 Interceptor 컨벤션

기각 대안: (1) 각 Service 메소드에 명시적 Correlation ID 파라미터 전달 — 침투성 증가, 기존 Service 시그니처 전면 수정 필요(Shotgun Surgery 악화). (2) cls-hooked (레거시) — Node 네이티브 AsyncLocalStorage로 대체됨

파급 효과:
- observability.md §Correlation ID 전파 (primary) — 헤더 이름(`X-Correlation-Id`), 생성 규칙(UUIDv4), 로그 필드 명, Winston 포맷 확장
- Phase 2에서 Global Interceptor 신설. 기존 Winston 로거가 Correlation ID 필드 자동 포함하도록 포맷 재정의
- async 이벤트 발행/수신 시 Correlation ID를 이벤트 헤더에 포함하여 async 경로 추적 가능 (async.md와 교차)

### [확정] Expand-and-Contract + Lazy Migration (TP8)

결정: Phase 5 보안 전환(argon2id, AES-GCM) 시점의 데이터 마이그레이션 전략으로 Expand-and-Contract + Lazy Migration 조합 [확정]. migrations 인프라는 Phase 0에서 선행 활성화된 상태 전제

근거: TP8 + Causes of Redesign 8 (synchronize:true로 스키마 변경 추적 불가) + Smell Oddball Solution (SHA256 3회 반복) + AntiPattern Reinvent the Wheel + Fowler "Expand-Contract" 리팩토링 패턴 + 업계 Lazy Migration 관행 (로그인 시점 비밀번호 재해싱)

기각 대안: (1) Big-Bang 일괄 마이그레이션 — 모든 사용자 데이터를 한 번에 재해싱/재암호화. 장시간 락 + 실패 시 전체 롤백. (2) Dual-write만 — 새 필드 추가 후 양쪽 쓰기만 하고 기존 데이터 마이그레이션 없음. 기존 데이터가 영구적으로 구식 해시/암호화로 남음

파급 효과:
- data-design.md: password 컬럼 포맷 전환 전략(알고리즘 태그 prefix: `$argon2id$`), PK 암호화 컬럼의 GCM mode IV 포맷
- security.md (Phase 5 primary): 해시/암호화 알고리즘 선정 및 마이그레이션 절차 상세
- migrations 인프라는 Phase 0에서 선행 활성화된 상태 전제. Phase 5의 argon2id/GCM 전환은 데이터 마이그레이션 스크립트로 수행

### [확정] Load Testing Methodology + User Journey Scenario (TP2)

결정: k6 기반 부하 테스트 환경. Phase 4/5 사이클에서 **Baseline + Load + Stress** 3종 필수 채택. Spike는 Phase 3 async 안정성 패턴(Circuit Breaker / Bulkhead / Rate Limiter) 중 1개 이상 적용 시 조건부 편입. User Journey Pattern 기반 시나리오 설계 (단순 endpoint 타격 지양) [확정]

근거: TP2 + Forces F3(측정 정확성 vs 로컬 장비 한계) / F7(단순 endpoint vs User Journey) / F8(1회성 vs 재현성) + context.md [학습 목표] "부하 테스트 기반 튜닝 경험" + Molyneaux "The Art of Application Performance Testing" (2014) 테스트 유형 분류

기각 대안: (1) 단순 endpoint 타격 — 실제 서비스 동작과 유리, User Journey 학습 가치 누락. (2) 6종 전부 채택 (Spike/Soak/Scalability 포함) — Soak는 시간 투자 대비 가치 낮음, Scalability는 로컬 환경·클라우드 out-of-scope로 의미 검증 불가. (3) 새 유형을 Phase 4·5 간에 변경 — before/after 비교 기준 변화로 튜닝 효과 왜곡

파급 효과:
- Phase 4 진입 시점에 해당 Phase 범위 Problem 재작성: 구체 시나리오(User Journey 정의)와 목표 규모(RPS / p99 latency / 동시 사용자 수치) 확정 — 알려진 불확실성 3 해소 시점
- observability.md (Phase 2): k6 결과를 관측성 대시보드에 통합하는 원칙(Prometheus Remote Write) 선정 — k6 채택 전제
- Phase 5 재측정은 Phase 4와 **동일 시나리오 + 동일 유형**으로 실행. 새 유형 추가 금지. 단, Phase 3 안정성 패턴이 Phase 4 시점에는 없었다가 Phase 5 이전에 추가된다면 Spike를 Phase 5에 신규 추가 허용 (일회성 예외)

### [가이드] Cursor-based Pagination (TP4)

결정: 글 목록 조회를 `(writeDatetime DESC, postId DESC)` 복합 키 커서 페이징으로 전환. API 계약: `cursor={encoded_writeDatetime_postId}&limit=20` [가이드]

근거: TP4 + Causes of Redesign 5 (offset 계산이 데이터 크기 의존) / 4 (페이지 번호 representation 의존) + 업계 표준 (Facebook/Twitter API 커서 페이징)

### [확정] Adjacency List for Reply (TP3)

결정: Reply는 Adjacency List 모델(`reply.commentId` 외래키 단일)로 구현. 깊이 1단계 제한(Comment → Reply만, Reply → Reply 불가) [확정]

근거: TP3 + methodology-ddd.md Aggregate Rule 2 (작은 Aggregate 선호) + 깊이 1 제한 도메인에서 Adjacency List가 쿼리·INSERT 모두 단순. Celko "Trees and Hierarchies in SQL" (2012) Ch.2 Adjacency List 트레이드오프 분석 — 깊이 1 도메인에서 우위

기각 대안:
- (1) Closure Table — 재귀 쿼리·삽입 시 N×depth 행 생성. 깊이 1 도메인에 과다
- (2) Nested Sets (Modified Preorder) — 삽입/삭제 시 좌우 인덱스 갱신 비용 큼
- (3) Materialized Path — 경로 문자열 저장. 깊이 변경 시 모든 자손 업데이트 필요

파급 효과:
- data-design.md §reply 테이블 — `comment_id BIGINT NOT NULL` 단일 외래키 구조 확정 (parent_reply_id 없음)
- application 레이어에서 깊이 1 강제는 스키마로 표현 불가 — Reply Service에서 "Reply에 대한 Reply 생성 API 미제공"으로 강제
- 깊이 N으로 확장 트리거 발생 시 Closure Table 마이그레이션 재검토

## 3방향 리팩토링 결정

### [확정] User Aggregate 재설계: Refactoring Towards Patterns (TP5)

결정: User Aggregate는 현재 상태(UserAuth.uid가 loginId와 email을 혼재)에서 목표 상태(Identity Separation + Account Linking)로 **점진적 이동**. 중간 단계 필수 [확정]

근거: methodology-pattern-selection.md 방향결정 층 (Kerievsky 3방향) + 직접 이동 시 외래키 연쇄 변경(Post / PostLike 등)의 리스크 과다

중간 단계의 절차 상세는 ../phase-1/data-migration.md 참조. 핵심 원칙:
- user 테이블 신설 → user_auth/user_auth_provider/user_info 재구성 → 외래키 전파 → Service 레이어 재작성 순서로 단계 분리
- 각 단계마다 E2E 테스트 통과 보증
- 기존 JWT payload(sub 필드)가 uid에서 userId로 변경 — 기존 토큰 무효화 고려 필요

기각 대안: (1) Refactoring To Patterns (직접 이동) — 외래키 + Service 레이어 동시 변경은 테스트 유실 리스크. 중간 검증 불가. (2) Refactoring Away From Patterns — 현재 구조가 이미 "없는" 패턴 상태라 "이탈"할 대상 없음

## Load Testing Strategy

### Phase 4 / Phase 5 사이클 개요

- Phase 4 (1차 사이클): 비동기화(Phase 3) 완료 후 베이스라인 수립. Baseline + Load + Stress 3종 채택 (Spike 조건부)
- Phase 5 (2차 사이클): 프로덕션 품질 개선(argon2id / AES-GCM / 메이저 업그레이드) 후 Phase 4와 동일 시나리오 + 동일 유형 재측정

### 테스트 유형 역할

- Baseline Test: 단일 VU(Virtual User) 저부하. 기준 응답 시간/쿼리 수. Phase 3 비동기화 전후, Phase 4/5 전후 비교의 절대 기준
- Load Test: 예상 피크 부하. p50/p95/p99 latency 분포. 비동기화 도입 효과(특히 p99 개선)의 정량 측정 주체
- Stress Test: 붕괴점 탐색. 비동기 시스템의 degradation 경험(큐 적재 증가, DLQ 진입, 커넥션 풀 고갈 등)
- Spike Test (조건부): Phase 3에서 Circuit Breaker / Bulkhead / Rate Limiter 중 1개 이상 적용 시 Phase 4에 편입 가능

### 시나리오 설계 원칙

- User Journey 기반: 실제 사용자 흐름 연쇄 재현 (예: 로그인 → 글 목록 조회 → 상세 조회 → 좋아요 → 댓글 작성)
- 재현성 보장: Phase 4/5 간 동일 스크립트 + 동일 목표 RPS + 동일 Ramp-up 패턴
- 관측성 통합: k6 실행 중 Correlation ID를 HTTP 헤더에 포함, Grafana 대시보드에 결과 연결

### 구체화 연기 항목

- User Journey별 스크립트 상세
- 목표 RPS / 동시 사용자 수 / p99 latency 목표치
- 측정 대상 엔드포인트 선정
- Spike Test 편입 여부 최종 확정

→ 모두 Phase 4 진입 시점의 Problem 재작성에서 확정 (알려진 불확실성 3 해소)

## 테스트 전략

- Unit Test (Jest + ts-jest): 모든 Service / 유틸 함수. 새 도메인 모듈(Comment/Reply/Notification) 추가 시 유닛 테스트 동반
- E2E Test (supertest + 실제 Docker 컨테이너): Phase 1 User Aggregate 재설계 후 인증 흐름 E2E 재작성 필수 (uid 기반 → userId 기반)
- Load Test (k6): Phase 4/5. 위 Load Testing Strategy 섹션 참조
- 정적 분석: ESLint + Prettier 유지. TypeScript strictNullChecks / noImplicitAny 유지

## Sources

- docs/context/{overview,domain,constraints,unknowns}.md
- docs/problem/{overview,use-cases,domain-spec,threat-model}.md
- docs/meeting-logs/2026-04-24.md
- ~/.claude/skills/mcpsi-solution/references/solution-writing-principles.md
- 방법론 근거:
  - Vernon "Implementing Domain-Driven Design" (2013) 4 Rules
  - Fowler "Patterns of Enterprise Application Architecture" (2003) Identity Field + Expand-Contract
  - Hohpe & Woolf "Enterprise Integration Patterns" (2003) Publish-Subscribe
  - Richardson "Microservices Patterns" (2018) Event-Driven
  - Helland "Idempotence is Not a Medical Condition" (ACM Queue 2012)
  - Kerievsky "Refactoring to Patterns" (2004) 3방향
  - Molyneaux "The Art of Application Performance Testing" (2014)
  - Celko "Trees and Hierarchies in SQL" (2012)
