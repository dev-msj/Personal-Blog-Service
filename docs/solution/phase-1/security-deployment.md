# Phase 1 Security Deployment

본 Phase에서 적용하는 security 결정. 정책 primary는 ../common/security.md.

## IDOR 방어 Service 레이어 소유권 확인

### 적용 대상

모든 Write API의 resource 소유권 확인 (../common/security.md §2.2):
- `PATCH /posts/:postId` / `DELETE /posts/:postId` — `Post.userId === authUserId` 검증
- `PATCH /posts/comments/:commentId` / `DELETE /posts/comments/:commentId` — `Comment.userId === authUserId` 검증
- `PATCH /posts/comments/:commentId/replies/:replyId` / `DELETE ...` — `Reply.userId === authUserId` 검증
- `DELETE /posts/:postId/likes` — `PostLike.userId === authUserId` 검증
- `PATCH /users/info` / `DELETE /users/info` — 인증된 userId로 자동 제한

### 구현 절차

1. 각 Service의 update/delete 메소드 진입부에 소유권 확인 코드 추가
2. 검증 실패 시 403 (도메인 예외 throw) 또는 404 (민감 리소스는 존재 여부 숨김)
3. 컨트롤러 레벨 우회 방지를 위해 **Service 레이어가 검증의 단일 책임**. 기존에 컨트롤러에서만 확인하던 경로는 Service로 이전
4. E2E 테스트로 타 사용자가 본인 외 리소스 수정/삭제 시 403/404 반환 검증

### 응답 코드 정책

- 404: Comment/Reply/Post 같은 리소스 존재 여부 자체를 보호해야 하는 케이스
- 403: User 본인 리소스 수정/삭제 시도(타인 권한 거부와 동일 처리, 학습 프로젝트 간결성)

## @nestjs/throttler 전역 등록

### 의존성 추가

```bash
npm install @nestjs/throttler
```

(Phase 1 진입 시 `package.json`에 추가, Phase 0 의존성 정리 정책 충족)

### 모듈 등록

`src/app.module.ts`:
- `ThrottlerModule.forRoot([...])` 등록 — `../common/security.md §5.2 경로별 제한 정책` 표 매핑
- Redis storage driver 사용 (`@nest-lab/throttler-storage-redis` 또는 직접 구현 — Phase 1 진입 시 라이브러리 안정성 평가)
- 전역 `APP_GUARD` Provider로 `ThrottlerGuard` 등록

### 경로별 제한 적용

각 경로별로 다른 제한값이 필요하므로 `@Throttle()` 데코레이터로 컨트롤러 메소드에 개별 설정 (전역 기본값은 가장 느슨한 정책 — 분당 200회 IP 기준):

```typescript
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Public()
@Post('login')
login(...) { ... }
```

매핑 표 (../common/security.md §5.2 정합):
- `POST /users/auth/login`: IP, 분당 10회
- `POST /users/auth/join`: IP, 시간당 5회
- `POST /users/auth/oauth`: IP, 분당 30회
- `POST /users/auth/refresh`: user_id 또는 IP fallback, 분당 10회
- Write API (POST/PATCH/DELETE): user_id, 분당 60회
- 읽기 API (GET): IP, 분당 200회

`Tracker`(IP vs user_id)는 ThrottlerGuard의 `getTracker()` 메소드 오버라이드로 구현. 인증된 요청은 user_id, 미인증은 `req.ip`.

### 429 응답 처리

ThrottlerGuard는 기본적으로 `ThrottlerException`을 throw하나, 본 프로젝트는 SuccessResponse/FailureResponse 컨벤션을 유지하므로:
- HttpExceptionFilter에서 ThrottlerException을 catch하여 `FailureResponse { code: COMMON_TOO_MANY_REQUESTS, message: ... }`로 변환
- 또는 ThrottlerGuard 자체를 확장하여 응답 포맷을 우리 컨벤션에 맞추기
- `Retry-After` 헤더는 ThrottlerGuard가 자동 설정

Phase 1 시점에는 HTTP 200 + FailureResponse 컨벤션 유지. Phase 5 RFC 9457 전환 시 자연스럽게 통합.

### ErrorCode 신설

`src/constant/ErrorCode.enum.ts`에 `COMMON_TOO_MANY_REQUESTS` (90xxx 영역) 추가. 새 도메인 예외 클래스 또는 기존 Common 카테고리에 포함.

## 로그인 실패 카운트 / 계정 잠금

../common/security.md §7 [가이드] 구현.

### 구현 위치

`src/user/service/user-auth.service.ts`의 login 메소드:

1. 요청 진입 시 Redis GET `login_fail:{loginId}` (Redis 키 구조는 ../common/data-design.md §Redis 키 구조 참조)
2. 카운트 ≥ 5 → AuthLockedException (응답: 401 + `Retry-After: 900` (15분, 잠금 사실 숨김 — 계정 열거 방지))
3. 비밀번호 검증
   - 실패 → Redis INCR `login_fail:{loginId}` + EXPIRE 900 → AuthInvalidPasswordException (401)
   - 성공 → Redis DEL `login_fail:{loginId}` → 정상 응답

### 데이터 구조

- Redis key: `login_fail:{loginId}`
- 값: integer (counter)
- TTL: 15분 (900초)
- 만료 시 자동 해제

### 새 도메인 예외

선택지 1: `AuthLockedException`을 별도 클래스로 생성 (이 경우 ErrorCode `AUTH_LOCKED` 신설 권장 — security.md §7과 정합)

선택지 2: AuthInvalidPasswordException으로 통합 처리 (잠금 사실 외부 노출 방지를 위해 401 일관). 구현 단순성 우위.

Phase 1 권장: **선택지 2** — UX 일관성 + 계정 열거 방지. 단 로그 메시지에는 잠금 사실 기록(observability.md §1.1 로그 포맷).

### 관측성 연계 (Phase 2 본격화)

Phase 1에는 audit_log 테이블이 아직 없으므로 Winston 구조화 로그(현 구조 유지)에 `event: auth.login.failure_locked` 등으로 기록. Phase 2 진입 시 audit_log INSERT로 전환 (관측성 모듈 신설 시점).

## OAuth Client ID 정책 (변경 없음)

../common/security.md §3 시크릿 카테고리 표 정합. Phase 1에서 추가 시크릿 도입 없음. Phase 2 진입 시 Slack Webhook 3종 추가.

## Sources

- ../common/security.md §2 인가 / §5 Rate Limiting / §7 침해 대응 알림 / §8 API Idempotency
- ../common/data-design.md §Redis 키 구조
- ../common/application-arch.md §Idempotency Key Pattern
- async-deployment.md (Idempotency-Key 헤더 구현 절차)
