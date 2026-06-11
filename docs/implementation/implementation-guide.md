# Implementation Guide — Phase 1: 기능 완성 + 도메인 재정비

## Phase 1 개요

- 해결 대상 Problem: BP3 (기능 완성도), TP3 (중복 요청 방지 + 댓글/답글), TP4 (커서 페이징), TP5 (User 식별자 재설계)
- 보조 영역: 보안 강화 (security.md §2·§5·§7 적용)
- Solution 출처:
  - docs/solution/phase-1/scope.md — 범위 5개
  - docs/solution/phase-1/arch-increment.md — 모듈 변경
  - docs/solution/phase-1/data-migration.md — 7단계 데이터 보존형 마이그레이션
  - docs/solution/phase-1/async-deployment.md — Idempotency-Key 수신 측
  - docs/solution/phase-1/security-deployment.md — IDOR / Throttler / 로그인 실패 카운트
  - docs/solution/phase-1/runtime-deployment.md — 인증 흐름 재작성 + Comment/Reply 동기 흐름
  - docs/solution/common/application-arch.md §3방향 리팩토링 [확정] — Refactoring Towards Patterns
- Phase 0 전제: synchronize:false migrations 인프라 + 단일 ioredis Provider(REDIS_CLIENT) + HealthModule 자기완결성 + gitleaks pre-commit + #89 PathParamAwareValidationPipe 회귀 보호

## Scope

### In Scope (Phase 1)

1. User Aggregate 재설계 — user / user_auth / user_auth_provider / user_info 4테이블 + OAuth Account Linking
2. 댓글·답글 기능 — comment / reply 신설 + CRUD API + 커서 페이징 / 전체 조회
3. 커서 페이징 (TP4) — Post 목록·사용자별 Post / Comment 목록
4. Idempotency-Key 헤더 적용 (TP3) — 모든 Write API
5. 보안 강화 — IDOR Service 레이어 / @nestjs/throttler 전역 / 로그인 실패 카운트 / COMMON_TOO_MANY_REQUESTS
6. 흡수 이슈 — #61 Provider 단위 테스트 컨벤션 / #69 UnexpectedCodeException 통합 / #70 verifyRefreshToken throw 통일 / #73 PostLike 예외 컨텍스트

### Out of Scope (인접 Phase 위임)

- Outbox / Kafka / BullMQ / notification 모듈 → Phase 3 (async-deployment.md §Phase 3 위임)
- observability/ 모듈 (Correlation ID Interceptor / audit_log / Metrics / Tracing) → Phase 2
- argon2id / AES-GCM 전환 → Phase 5
- RFC 9457 Problem Details → Phase 5
- ADMIN 차등 권한 → out-of-scope 트리거 시
- Swagger 대규모 리팩토링(#45) → Phase 5

## 1. Flow 인덱스

흐름 서술 본문은 docs/implementation/flows/{flow-id}.md에 단일 위치. 본 인덱스는 flow-id + 커버 UC + Aggregate + runtime-behavior 매핑만 제공.

| flow-id | 커버 UC | Aggregate | runtime-behavior | 경로 |
|---------|---------|-----------|------------------|------|
| user-register | UC-1 | User | — | flows/user-register.md |
| user-login | UC-2 | User | — | flows/user-login.md |
| user-oauth-login | UC-3 | User | SEQ-3 instantiation | flows/user-oauth-login.md |
| user-token-refresh | UC-4 | User | DT-2 R5·R6 instantiation | flows/user-token-refresh.md |
| blog-post-write | 단순 CRUD + INV-6 | Post | — | flows/blog-post-write.md |
| blog-post-read-detail | UC-5 | Post | SEQ-1 Phase 1 부분 | flows/blog-post-read-detail.md |
| blog-post-list | UC-7 | Post | — | flows/blog-post-list.md |
| post-like-toggle | UC-6 | Post (PostLike) | SEQ-2 Phase 1 부분 | flows/post-like-toggle.md |
| comment-write | UC-8 + 수정/삭제 | Post (Comment) | SEQ-4a Phase 1 부분 | flows/comment-write.md |
| reply-write | UC-9 + 수정/삭제 | Post (Reply) | SEQ-4a 패턴 공유 | flows/reply-write.md |
| comment-list-read | 단순 CRUD | Post (Comment + Reply) | — | flows/comment-list-read.md |
| idempotency-key-handle | UC-1·6·8·9 *a Extension (cross-cutting) | (cross-cutting, Redis) | SEQ-2 Idempotency 분기 instantiation | flows/idempotency-key-handle.md |

## 2. Aggregate / Invariant 재수록

### User Aggregate

application-arch.md §User Aggregate + data-design.md §user/user_auth/user_auth_provider/user_info + domain-spec.md §Phase 진화에 따른 INV 변경 예고 통합:

Invariants (Phase 1 재정의):
- INV-1' [확정]: UserAuth.login_id는 전역 유일 (일반 가입 경로). NULL 허용 (OAuth-only 사용자) 단, NULL이 아닌 값은 UNIQUE
- INV-2 [확정]: UserInfo.nickname은 전역 유일
- INV-3 [확정]: 한 User에 UserAuth 1:0..1, UserInfo 1:1, UserAuthProvider 1:0..N
- INV-4 [확정]: 비밀번호는 평문 미저장 (현 SHA256 3회, Phase 5 argon2id)
- INV-AP1 [확정] (신규): UserAuthProvider의 (provider, provider_subject) 조합은 전역 유일 (스키마 UNIQUE 강제)
- INV-10 [확정]: 인증 통과 = AccessToken 서명/만료 OK ∧ RefreshToken DB 일치
- INV-11 [확정]: RefreshToken Rotation 원자성 — access + refresh + DB 갱신 단일 트랜잭션
- INV-12 폐기, INV-5 폐기 (TP5 재설계로 socialYN 제거)

내부 Entity 카디널리티는 application-arch.md §User Aggregate 참조.

### Post Aggregate

Invariants:
- INV-6 [확정]: Post 본인만 수정/삭제 (Post.user_id = authUserId)
- INV-7 [확정]: hits ≥ 0, 단조 증가 (Phase 3 비동기 전환 시 eventual consistency)
- INV-8 [확정]: PostLike (post_id, user_id) UNIQUE — 1인 1회
- INV-9 [확정]: User 삭제 시 Post/PostLike/Comment/Reply CASCADE, Post 삭제 시 PostLike/Comment/Reply CASCADE, Comment 삭제 시 Reply CASCADE
- INV-Cmt1 [확정] (신규): Comment.post_id 참조 무결성 (fk_comment_post)
- INV-Cmt2 [확정] (신규): Comment.user_id 참조 무결성 (fk_comment_user)
- INV-Rpl1 [확정] (신규): Reply.comment_id 참조 무결성 (fk_reply_comment)
- INV-Rpl2 [확정] (신규): 계층 깊이 1단 제한 (Reply → Reply 불가, application-level 강제)

Phase 1 종료 시점에 domain-spec.md §Phase 진화 변경 예고 신규 INV 4건을 problem/domain-spec.md에 사후 정형화 (unknowns.md에 명시된 후속 액션).

## 3. 인터페이스 시그니처

각 Service/Repository/Util의 시그니처 단일 진실 원천. flows/ §5에서 본 섹션을 역참조.

### 3.1 user-auth.service

```typescript
class UserAuthService {
  async join(dto: JoinDto): Promise<void>
  async login(dto: LoginDto): Promise<JwtDto>
  async oauthLogin(credentialToken: string): Promise<JwtDto>
  async refresh(refreshToken: string): Promise<JwtDto>
}
```

### 3.2 user-auth.repository

```typescript
class UserAuthRepository {
  async findByLoginId(loginId: string): Promise<UserAuthEntity | null>
  async findByUserId(userId: bigint): Promise<UserAuthEntity | null>
  async findRefreshTokenForUpdate(userId: bigint, qr: QueryRunner): Promise<string | null>
  async updateRefreshToken(userId: bigint, token: string | null, qr: QueryRunner): Promise<void>
}
```

### 3.3 user.repository

```typescript
class UserRepository {
  async createWithAuthAndInfo(
    auth: NewUserAuth,
    info: NewUserInfo,
    qr: QueryRunner,
  ): Promise<bigint>  // returns user_id

  async createOAuthUser(
    provider: NewUserAuthProvider,
    info: NewUserInfo,
    qr: QueryRunner,
  ): Promise<bigint>

  async linkProvider(
    userId: bigint,
    provider: NewUserAuthProvider,
    qr: QueryRunner,
  ): Promise<void>
}
```

### 3.4 user-info.service / repository

(기존 구조 유지. user_id BIGINT 외래키 적용. 본 Phase 직접 신규 메소드 없음 — 외래키 타입 마이그레이션 + IDOR 검증 추가)

### 3.5 user-auth-provider.repository

```typescript
class UserAuthProviderRepository {
  async findByProviderSubject(
    provider: 'GOOGLE',
    subject: string,
  ): Promise<UserAuthProviderEntity | null>

  async findUserIdByEmail(email: string): Promise<bigint | null>

  async insert(entity: NewUserAuthProvider, qr: QueryRunner): Promise<void>
}
```

### 3.6 post.service

```typescript
class PostService {
  async create(cmd: CreatePostCommand): Promise<PostDto>
  async update(cmd: UpdatePostCommand): Promise<void>  // IDOR throws PostNotFoundException
  async delete(cmd: DeletePostCommand): Promise<void>  // IDOR throws PostNotFoundException
  async findOne(postId: bigint, authUserId: bigint): Promise<PostDto>  // hits++
  async list(query: ListPostQuery): Promise<CursorPage<PostDto>>
  async listByUser(userId: bigint, query: CursorPaginationDto): Promise<CursorPage<PostDto>>
}
```

CursorPage 구조: `{ items: T[]; next_cursor: string | null }`

### 3.7 post.repository

```typescript
class PostRepository {
  async findById(postId: bigint, qr?: QueryRunner): Promise<PostEntity | null>
  async existsById(postId: bigint, qr?: QueryRunner): Promise<boolean>
  async insertOwned(post: NewPost, qr: QueryRunner): Promise<bigint>
  async updateByIdAndOwner(
    postId: bigint, userId: bigint, patch: Partial<PostEntity>, qr: QueryRunner,
  ): Promise<number>  // affected rows
  async deleteByIdAndOwner(postId: bigint, userId: bigint, qr: QueryRunner): Promise<number>
  async incrementHits(postId: bigint, qr: QueryRunner): Promise<void>  // UPDATE hits = hits + 1
  async findByCursor(
    cursor: PostCursor | null, limit: number, userId?: bigint,
  ): Promise<PostEntity[]>
}
```

### 3.8 post-like.repository

```typescript
class PostLikeRepository {
  async insert(postId: bigint, userId: bigint, qr: QueryRunner): Promise<void>
    // UNIQUE 충돌 → PostLikeAlreadyExistsException
    // FK 충돌 → PostNotFoundException
  async delete(postId: bigint, userId: bigint, qr: QueryRunner): Promise<number>  // affected rows
  async exists(postId: bigint, userId: bigint): Promise<boolean>
  async getPostLikeMapByPostIds(
    postIds: bigint[], authUserId: bigint,
  ): Promise<Map<bigint, boolean>>
  async countByPostIds(postIds: bigint[]): Promise<Map<bigint, number>>
  async countByPostId(postId: bigint): Promise<number>
}
```

### 3.9 post-like.service

```typescript
class PostLikeService {
  async like(postId: bigint, userId: bigint): Promise<void>
  async unlike(postId: bigint, userId: bigint): Promise<void>
}
```

### 3.10 comment.service

```typescript
class CommentService {
  async create(cmd: CreateCommentCommand): Promise<CommentDto>
  async update(cmd: UpdateCommentCommand): Promise<void>
  async delete(cmd: DeleteCommentCommand): Promise<void>
  async list(postId: bigint, query: CursorPaginationDto): Promise<CursorPage<CommentDto>>
}
```

### 3.11 comment.repository

```typescript
class CommentRepository {
  async findById(commentId: bigint, qr?: QueryRunner): Promise<CommentEntity | null>
  async existsById(commentId: bigint, qr?: QueryRunner): Promise<boolean>
  async insertOwned(comment: NewComment, qr: QueryRunner): Promise<bigint>
  async updateByIdAndOwner(...): Promise<number>
  async deleteByIdAndOwner(...): Promise<number>
  async findByCursor(
    postId: bigint, cursor: CommentCursor | null, limit: number,
  ): Promise<CommentEntity[]>
}
```

### 3.12 reply.service

```typescript
class ReplyService {
  async create(cmd: CreateReplyCommand): Promise<ReplyDto>
  async update(cmd: UpdateReplyCommand): Promise<void>
  async delete(cmd: DeleteReplyCommand): Promise<void>
  async listByComment(commentId: bigint): Promise<ReplyDto[]>
}
```

### 3.13 reply.repository

```typescript
class ReplyRepository {
  async findById(replyId: bigint, qr?: QueryRunner): Promise<ReplyEntity | null>
  async insertOwned(reply: NewReply, qr: QueryRunner): Promise<bigint>
  async updateByIdAndOwner(...): Promise<number>
  async deleteByIdAndOwner(...): Promise<number>
  async listByComment(commentId: bigint): Promise<ReplyEntity[]>
}
```

### 3.14 유틸 / cross-cutting 인터페이스

flow §5 인터페이스 계약 표가 역참조하는 유틸·cross-cutting 시그니처의 단일 진실 원천. 알고리즘 본체가 §8에 있는 항목은 시그니처만 두고 §8로 위임.

```typescript
// 비밀번호 해싱 (기존 crypto 모듈, SHA256 3회 — Phase 5 argon2id)
function hashPassword(password: string, salt: string): string

// JWT 발급/검증 (#70 흡수: verifyRefreshToken throw 통일)
class JwtService {
  issueTokens(userId: bigint, role: UserRole): { accessToken: string; refreshToken: string }
  verifyRefreshToken(token: string): JwtPayload  // 실패 시 도메인 예외 throw (§9.3)
}

// 로그인 실패 카운터 (Redis login_fail:{loginId}, §6.3 / 상태전이 §7.2)
class LoginFailCounter {
  get(loginId: string): Promise<number>
  incr(loginId: string): Promise<number>  // TTL 15분
  del(loginId: string): Promise<void>      // 로그인 성공 시 즉시 absent
}

// Idempotency 저장소 (Redis idempotency:{user_id}:{key}, §6.3 / 상태전이 §7.1)
class IdempotencyService {
  get(userId: bigint, key: string): Promise<IdempotencyRecord | null>
  setPending(userId: bigint, key: string, method: string, path: string): Promise<boolean>  // SETNX
  setCompleted(userId: bigint, key: string, statusCode: number, body: unknown): Promise<void>  // TTL 24h
}

// Google OAuth 검증 wrapper (google-auth-library)
class GoogleAuthVerifier {
  verifyIdToken(args: { idToken: string; audience: string }): Promise<{ sub: string; email: string }>
}
```

- nicknameUtils.deriveFromEmail(email: string): string — 알고리즘 §8.4
- cursorUtils.encode(item)/decode(cursor) — 알고리즘 §8.1
- QueryRunner 트랜잭션 패턴 (dataSource.createQueryRunner) — §8.2 Rotation / §8.5 IDOR

## 4. Interceptor / Pipe / Guard

### 4.1 SetRefreshTokenCookieInterceptor (기존 유지)

응답 객체가 `JwtDto` 형태(refreshToken 포함) 시 자동으로 HTTPOnly 쿠키 설정. user 모듈 내부.

### 4.2 IdempotencyKeyInterceptor (신규)

```typescript
class IdempotencyKeyInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown>
}
```

전역 APP_INTERCEPTOR로 등록. AuthGuard 후행. 처리 로직은 flows/idempotency-key-handle.md.

선택 데코레이터 `@SkipIdempotency()`: login/refresh/oauth 핸들러에 부착하여 Interceptor 우회.

### 4.3 DecryptPrimaryKeyPipe (기존 유지, #89 회귀 보장)

Path Param 자동 복호화 (PathParamAwareValidationPipe가 ValidationPipe transformPrimitive 우회 보장).

### 4.4 EncryptPrimaryKeyInterceptor (기존 유지)

`@EncryptField()` 적용 DTO 필드 자동 암호화.

### 4.5 AuthGuard (Phase 1 수정)

- payload.sub `BIGINT parseInt` 변환 (uid VARCHAR → user_id BIGINT)
- 변환 실패 시 AuthUnauthorizedException
- RefreshToken DB 대조는 기존 동작 유지 (user_auth.refresh_token)
- DT-2 6분기를 코드로 표현 (runtime-deployment.md §1.1 다이어그램과 정합)

```typescript
class AuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): Promise<boolean>
}
```

### 4.6 ThrottlerGuard (전역 APP_GUARD)

`@nestjs/throttler` 신규 의존성. `app.module.ts`에서 ThrottlerModule.forRoot + APP_GUARD 등록. Tracker getter 오버라이드로 인증 요청은 user_id, 미인증은 IP.

ThrottlerException → BaseExceptionFilter가 `FailureResponse(COMMON_TOO_MANY_REQUESTS)`로 변환 + Retry-After 헤더 유지.

미확정 (Phase 1 진입 시 결정): `@nest-lab/throttler-storage-redis` 라이브러리 안정성 평가 → 채택 또는 직접 ioredis 기반 storage 구현. 첫 Throttler 적용 이슈 진입 시점에 결정 (§11 미확정 사항).

## 5. ErrorCode 변경 (src/constant/ErrorCode.enum.ts)

신규 추가:
- `COMMON_TOO_MANY_REQUESTS` = 90008 (90xxx 영역) — Rate Limit 초과
- `IDEMPOTENCY_IN_PROGRESS` = 90009 (90xxx 영역) — Idempotency pending 중복 요청 (선택, 또는 COMMON_TOO_MANY_REQUESTS 재사용 — flow idempotency-key-handle §3.2 결정 위임)
- `COMMENT_NOT_FOUND` = 32001 (32xxx Comment 도메인)
- `REPLY_NOT_FOUND` = 32002

폐기 검토:
- 기존 30xxx Post 도메인 / 31xxx PostLike 도메인 유지
- `USER_NOT_FOUND` (20001) 유지

## 6. 데이터 모델

### 6.1 스키마 (Phase 1 최종 형상)

data-design.md §user/user_auth/user_auth_provider/user_info/post/post_like/comment/reply 참조. 본 섹션은 차이점만 요약:

- user (신설) — user_id BIGINT AUTO_INCREMENT PK
- user_auth (재구성) — PK가 uid VARCHAR → user_id BIGINT (FK + PK). login_id VARCHAR(100) NULL UNIQUE
- user_auth_provider (신설) — (provider, provider_subject) UNIQUE, email VARCHAR(320) NULL, FK user_id
- user_info (외래키 변경) — PK가 uid VARCHAR → user_id BIGINT (FK + PK)
- post (외래키 변경 + 인덱스 추가) — user_id BIGINT FK, idx_post_cursor (write_datetime DESC, post_id DESC), idx_post_user
- post_like (외래키 변경) — user_id BIGINT FK, 복합 PK (post_id, user_id)
- comment (신설) — comment_id, post_id FK, user_id FK, content, idx_comment_post_cursor
- reply (신설) — reply_id, comment_id FK, user_id FK, content, idx_reply_comment

### 6.2 Migration 절차

data-migration.md §단계 1~7 — 데이터 보존형. 각 단계는 독립 migration 파일 + E2E 통과:

1. user 테이블 신설
2. user_auth 재구성 (user_id_new 추가 → 데이터 이동 → 기존 uid PK 제거)
3. user_auth_provider 신설 + 기존 OAuth 사용자(socialYN='Y') 매핑
4. user_info 외래키 변경
5. post / post_like 외래키 변경 (post_uid → user_id)
6. post 커서 페이징 인덱스 추가
7. comment / reply 테이블 신설

각 migration의 `down()` 메소드에 역방향 로직 작성. 기존 데이터 양이 적어 단일 트랜잭션 처리.

### 6.3 Redis 키 구조

| 키 패턴 | 용도 | 값 | TTL |
|---------|------|-----|-----|
| `login_fail:{loginId}` | 로그인 실패 카운터 | integer | 15분 (900s) |
| `idempotency:{user_id}:{idempotency_key}` | Idempotency 응답 캐시 | JSON `{state, statusCode, responseBody, method, path, processedAt}` | 24시간 (86400s) |

ioredis 단일 Provider(REDIS_CLIENT, Phase 0 #86)를 통해 접근.

## 7. 상태 전이 매핑

### 7.1 Idempotency Key state (Redis JSON.state)

```
[absent] --SETNX--> pending --SET--> completed --TTL 24h--> [absent]
```

application-level 강제 (Repository에 명시 transition 메소드만 노출). NotificationRepository 패턴(Phase 3 STM-Notification)과 유사한 단방향 life-cycle 정책.

### 7.2 로그인 실패 카운터 (Redis login_fail counter)

```
absent → 1 → 2 → 3 → 4 → 5(locked) → TTL 15분 만료 → absent
```

5회 도달 시 잠금 (security-deployment.md §로그인 실패 카운트 — security.md §7과 정합). 로그인 성공 시 DEL로 즉시 absent.

## 8. 핵심 알고리즘

### 8.1 Cursor 인코딩/디코딩 (Post / Comment 공통)

```typescript
// cursor 형식: base64url(JSON { w: ISO8601, p: bigint string })
function encode(item: { writeDatetime: Date; postId: bigint }): string {
  return base64url(JSON.stringify({ w: item.writeDatetime.toISOString(), p: String(item.postId) }))
}
function decode(cursor: string): { writeDatetime: Date; postId: bigint } {
  const { w, p } = JSON.parse(base64urlDecode(cursor))
  return { writeDatetime: new Date(w), postId: BigInt(p) }
}
```

WHERE 절: `(write_datetime, post_id) < (cursor.w, cursor.p)` 튜플 비교. Comment는 ASC라 `>` 사용.

[가이드 — application-arch.md] base64 vs JSON 인코딩 선택은 자율. Comment cursor는 동일 패턴(`c: createdDatetime, i: commentId`).

### 8.2 RefreshToken Rotation (data-design.md §Rotation 원자성)

```
1. QueryRunner.startTransaction()
2. SELECT refresh_token FROM user_auth WHERE user_id = ? FOR UPDATE
3. cookie === stored 비교 (불일치 시 ROLLBACK + AuthInvalidRefreshTokenException)
4. 새 access + refresh 발급 (JWT sign)
5. UPDATE user_auth SET refresh_token = new WHERE user_id = ?
6. commit
7. 실패 시 rollback + AuthInvalidRefreshTokenException (Rotation 원자성 INV-11)
```

### 8.3 OAuth Account Linking (SEQ-3 §3.3 결정 흐름)

```
1. google-auth-library.verifyIdToken({ idToken, audience })
2. payload.sub로 user_auth_provider 조회
   - 존재 → user_id 즉시 확보 (분기 A: 기존 OAuth)
3. provider_subject 미일치 시 payload.email로 기존 user 탐지 (user_auth_provider.email 또는 별도 lookup)
   - 존재 → 분기 B: Account Linking
     - INSERT user_auth_provider (user_id, provider, provider_subject, email)
   - 미존재 → 분기 C: 완전 신규
     - INSERT user → user_auth (login_id NULL, password NULL) → user_auth_provider → user_info (nickname derived)
4. 합류: user_id 확보 후 JWT 발급 + UserAuth.refresh_token UPDATE (Rotation 원자성)
```

lookup 출처 결정 (implementation-guide.md TODO — Phase 1 구현 시점): user 테이블에 email 컬럼 없음. user_auth_provider.email로 기존 user 탐지 시도하되, `email IS NOT NULL` + 동일 email로 매칭되는 user_id 반환. 다중 매칭 시 가장 오래된 user 선택 (학습 프로젝트 단순성).

### 8.4 Nickname Derivation (UC-3 신규 가입)

```
1. base = payload.email.split('@')[0] (최대 30자)
2. INSERT user_info (nickname=base) 시도
3. UNIQUE 충돌 시 base + '#' + random(4 digits) 재시도 (최대 3회)
4. 3회 실패 시 random uuid 8자 사용
```

INV-2 (nickname UNIQUE) 보장. user_info insert에서만 사용.

### 8.5 IDOR 방어 패턴 (모든 Write API)

Service 레이어 단일 책임. Repository UPDATE/DELETE 쿼리에 WHERE 절 `user_id = ?` 동등 조건 추가하여 DB-level 2차 방어.

```typescript
async updateByIdAndOwner(id, userId, patch, qr): Promise<number> {
  const affected = await qr.manager
    .createQueryBuilder()
    .update(Entity)
    .set(patch)
    .where('id = :id AND user_id = :userId', { id, userId })
    .execute()
  return affected.affected ?? 0
}
// affected === 0 시 Service에서 *NotFoundException throw (404 정책)
```

404 응답 정책: Comment/Reply/Post 모두 존재 여부 자체 보호 (security-deployment.md §응답 코드 정책).

## 9. Exception 계층

기존 BaseException 계층 유지. Phase 1에서 다음 변경:

### 9.1 신규 도메인 예외 추가

src/exception/blog/:
- `PostLikeAlreadyExistsException` — #73 흡수: `{ uid: bigint; postId: bigint }` 컨텍스트 필드 추가
- `PostLikeNotFoundException` — #73 흡수: 동일 컨텍스트
- `CommentNotFoundException` (신규) — `{ uid: bigint; commentId: bigint }`
- `ReplyNotFoundException` (신규) — `{ uid: bigint; replyId: bigint }`

barrel `src/exception/blog/index.ts`에 export 추가.

### 9.2 #69 UnexpectedCodeException 통합 검토 결과

현재 `UnexpectedCodeException`은 BaseException 하위로 catch-all 폴백 역할. Phase 1 검토:
- BaseException을 abstract 유지 (직접 인스턴스화 차단)
- UnexpectedCodeException은 ErrorCode `COMMON_INTERNAL_ERROR` 매핑된 구체 클래스로 유지
- 새 신규 예외(Comment/Reply)도 동일 패턴

Phase 5 RFC 9457 전환 시 추가 통합 가능성 있음 — 본 Phase는 통합 보류 + 패턴 정렬만 수행. 결정 사유: Phase 1은 신규 도메인 예외 다수 추가 중 — 통합 작업과 신규 작업 동시 진행 시 회귀 리스크.

### 9.3 #70 verifyRefreshToken throw 통일 결과

`JwtService.verifyRefreshToken` 시그니처를 throw 방식으로 변경 (flow user-token-refresh §5):
- 성공: `JwtPayload` 반환
- 실패: 정확한 도메인 예외 throw (`AuthInvalidRefreshTokenException` / `AuthRefreshTokenRequiredException`)

기존 `{ valid, payload }` 객체 반환 경로 제거. AuthGuard, UserAuthService.refresh에서 try/catch로 처리.

### 9.4 Filter 계층 (기존 유지)

BaseExceptionFilter / HttpExceptionFilter / UnhandledExceptionFilter 3개 계층. ThrottlerException은 HttpExceptionFilter에서 catch → COMMON_TOO_MANY_REQUESTS 변환.

## 10. Phase 0 → Phase 1 인터페이스 연결점

| Phase 0 산출물 | Phase 1 활용 |
|----------------|--------------|
| synchronize:false + migrations 활성화 (#79) | data-migration.md 7단계 데이터 보존형 마이그레이션 작성 가능 |
| 단일 ioredis Provider REDIS_CLIENT (#86) | IdempotencyService / LoginFailCounter / @nest-lab/throttler-storage-redis 가 동일 ioredis 인스턴스 활용 |
| PathParamAwareValidationPipe (#89) | DecryptPrimaryKeyPipe path 우회 보장 — Phase 1 모든 PK 복호화 엔드포인트 회귀 보호 |
| HealthModule 자기완결성 (#77) | Phase 1 신규 모듈 추가가 HealthModule 트리 영향 없음 |
| gitleaks pre-commit (#78) | Phase 1 새 환경변수(throttler 관련) commit 시 시크릿 검출 보장 |

## 11. 미확정 사항

### 블로커 (구현 진입 시 결정)

1. **@nest-lab/throttler-storage-redis 라이브러리 평가** (security-deployment.md §모듈 등록)
   - 결정 시점: 첫 Throttler 적용 이슈 진입 시
   - 결정 기준: (a) NestJS 10 호환성 (b) 단일 ioredis Provider(REDIS_CLIENT) 주입 가능성 (c) 최근 1년 이내 release + 활성 maintenance
   - 미충족 시: 직접 ioredis 기반 ThrottlerStorage 구현 (`implements ThrottlerStorage`)

### 허용 (구현 PR에서 결정)

2. ThrottlerGuard 응답 포맷 통합 방식 (Filter vs Guard 확장)
3. 403 vs 404 응답 코드 선택 (security-deployment.md §응답 코드 정책 — 가이드라인 명시)
4. 미인증 요청에 Idempotency 적용 여부 (Phase 1 결정: 미적용)
5. Cursor 인코딩 형식 (base64 vs JSON 명시) — §8.1에 base64url(JSON) 권고하되 자율
6. PaginationDto cursor 전환 vs CursorPaginationDto 신규 — Phase 1 권고: 신규 도입
7. Idempotency Interceptor의 NestJS 위치 (Interceptor vs Guard) — Interceptor 권고 (응답 캐싱 흐름 자연)
8. OAuth Account Linking lookup 출처 (§8.3) — user_auth_provider.email 매칭 권고
9. comment/reply 부모 미존재 시 빈 배열 vs NotFound (comment-list-read §3.1) — 빈 배열 권고

## 마이그레이션 전략

User Aggregate 재설계(uid VARCHAR → user_id BIGINT 분리 + UserAuthProvider 신설)는 스키마 PK/FK 변경 + 호출자 3개 이상 연쇄 + 기존 E2E SUT 핵심 변경의 cascading breakage 신호를 동반한다. application-arch.md §3방향 리팩토링 [확정](Refactoring Towards Patterns, 점진적 이동, 중간 단계 필수)에 따라 Parallel Change(Expand-Migrate-Contract)를 적용한다. 본 섹션은 신규 구조 결정이 아니라 data-migration.md의 expand-migrate-contract 절차에 표준 전략명을 부여하고 그린 게이트·신구 공존 기간을 명문화하는 정합 기록이다.

전략: Parallel Change (Expand-Migrate-Contract)

사유: 식별자 모델/스키마 교체로 호출자 다수가 연쇄 변경되며, data-migration.md 단계 2·4·5가 "backwards-compatible 컬럼 추가 → 데이터 이동 → 기존 컬럼/PK 제거" 절차로 이미 expand-migrate-contract 구조를 구현한다. 각 단계 독립 migration 파일 + 단계별 E2E 그린 게이트가 이슈 분할 하한이다. 기각: Branch by Abstraction(라이브러리/계층 교체)·Strangler Fig(레거시 점진 교체)는 본 변경이 스키마/식별자 모델 전이라 부적합. Feature Toggle은 1회성 스키마 전이에 과잉. 통합 이슈는 호출자 3+/스키마 PK 변경이라 atomic 단위 초과.

시리즈 단계별 책임 (단계명은 parallel-change 정의 집합 expand/migrate/contract 준수):
- expand (#117): user 테이블 신설. 기존 구조 무영향 (data-migration 단계 1)
- migrate (#118·#119·#121·#122): user_id 컬럼 추가 → UPDATE JOIN 데이터 매핑 + Entity/Repository가 user_id 키를 제공. 학습 규모상 컬럼 전환은 단일 트랜잭션 (data-migration 단계 2·4·5). socialYN 폐기는 login_id NULL 마킹으로 대체. 그린 게이트: Service 외부 계약(HTTP 응답)은 불변이라 기존 E2E가 통과해야 하며, Repository는 contract 단계 전까지 기존 호출 시그니처와 호환을 유지한다 (불가 시 분할 재검토 — testing-strategy.md §13)
- migrate (#120): user_auth_provider 신설 + 기존 OAuth 사용자(login_id NULL) 매핑 (data-migration 단계 3)
- contract (#128·#129·#130·#131): AuthGuard sub BIGINT parseInt + Service 레이어를 user_id 기반으로 재작성하여 구 uid 경로 완전 제거. 모든 migrate 단계 이슈를 선행으로 가진다. verifyRefreshToken throw 통일(#70 흡수)도 동일 단계의 호출부 정리

신구 공존 기간:
- DB 구조: 각 migrate 단계 migration의 트랜잭션 내부 한정. 커밋 시점에 구조 단일화 (중간 실패 시 데이터 무결성 보존, data-migration 가역성)
- 식별 의미: socialYN → login_id NULL(OAuth-only) 마킹은 Phase 1 이후 영구 공존 형태 (data-design.md user_auth login_id NULL UNIQUE)
- JWT payload: sub의 uid→user_id 전환으로 기존 발급 AccessToken은 자연 만료까지 공존. AuthGuard sub parseInt 실패 → AuthUnauthorizedException(testing-strategy.md TC-96)이 공존 종료를 안전 처리

이슈별 단계 메타는 issue-plan.md 각 이슈의 `migration: parallel-change/<단계>` 라인에 부여한다 (plan-format.md 들여쓴 보조 라인).

비대상: comment/reply 신설(#124)·커서 인덱스(#123)·신규 도메인 모듈(#125·#126·#127)은 additive 변경으로 cascading breakage 신호가 없어 마이그레이션 전략 비대상이다.

## Sources

- docs/solution/phase-1/{scope,arch-increment,data-migration,async-deployment,security-deployment,runtime-deployment}.md
- docs/solution/common/{overview,application-arch,data-design,async,security,runtime-behavior}.md
- docs/problem/{use-cases,domain-spec}.md
- docs/implementation/flows/*.md (12개)
- docs/implementation/testing-strategy.md
- GitHub Issues #61, #69, #70, #73 (Phase 1 흡수)
- 방법론: Vernon IDDD Rule 1/3/4, Helland Idempotence, OWASP IDOR/Authentication/JWT, Fowler Identity Field, RFC 4122 (UUID), Stripe Idempotency API
