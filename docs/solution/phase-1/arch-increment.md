# Phase 1 Architecture Increment

## 모듈 변경

```text
src/
├── user/
│   ├── (재편) controller / service / repository — userId 기반으로 인증 흐름 재작성
│   ├── (신설) UserAuthProvider 관련 entity/dao/repository/service
│   └── (변경) UserAuth / UserInfo 엔티티 — userId FK 적용
├── blog/
│   ├── post/         # 기존
│   ├── post-like/    # 기존
│   ├── comment/      # 신설 — controller / service / dao / repository / entities / dto
│   └── reply/        # 신설 — Adjacency List 모델
└── (변경 없음) auth/ — AuthGuard 시그니처는 그대로 (sub → userId 변환은 user 모듈 책임)
```

신규 모듈/디렉토리 추가 시 기존 컨벤션 따름 (controller/service/repository/dao/dto/entities/repository).

## 변경 항목

### user 모듈 재편

- 기존: `UserAuth(uid VARCHAR PK)` + `UserInfo(uid VARCHAR PK)`
- 변경 후: `User(user_id BIGINT PK)` + `UserAuth(user_id PK FK, login_id UNIQUE NULL)` + `UserAuthProvider(provider_id PK, user_id FK, provider, provider_subject)` + `UserInfo(user_id PK FK)`

신설 클래스:
- `UserEntity` (Aggregate Root)
- `UserAuthProviderEntity`
- `UserAuthProviderRepository`
- `UserAuthProviderService` 또는 user-auth.service에 메소드 추가 (단일 Aggregate 내부 Entity로 처리)

수정 클래스:
- `UserAuthEntity` (PK 타입 + 컬럼명 변경)
- `UserInfoEntity` (PK 타입 변경)
- `UserAuthRepository` (find 키 변경)
- `user-auth.service`:
  - OAuth 로그인 흐름 재작성: email 기반 기존 User 탐지 → 신규 UserAuthProvider 연결 또는 신규 User 생성
  - JWT payload sub 필드를 uid에서 userId(BIGINT)로 변경
  - login_id 정책: 일반 가입은 필수, OAuth 전용 사용자는 NULL 허용

### blog 모듈 확장

신설:
- `CommentEntity` + `CommentRepository` + `CommentService` + `CommentController` + DTO (Create/Update/Get)
- `ReplyEntity` + `ReplyRepository` + `ReplyService` + `ReplyController` + DTO

엔드포인트 신설 (REST):
- `POST /posts/:postId/comments` — 댓글 작성
- `PATCH /posts/comments/:commentId` — 댓글 수정 (소유권 확인)
- `DELETE /posts/comments/:commentId` — 댓글 삭제 (소유권 확인)
- `GET /posts/:postId/comments` — 댓글 커서 페이징 조회
- `POST /posts/comments/:commentId/replies` — 답글 작성
- `PATCH /posts/comments/:commentId/replies/:replyId` — 답글 수정 (소유권 확인)
- `DELETE /posts/comments/:commentId/replies/:replyId` — 답글 삭제 (소유권 확인)
- `GET /posts/comments/:commentId/replies` — 답글 전체 조회

수정:
- post 엔티티 외래키: `post_uid VARCHAR` → `user_id BIGINT FK`
- post_like 엔티티 외래키: `uid VARCHAR` → `user_id BIGINT FK`
- post 조회 API: offset 페이징 → cursor 페이징 (TP4)
- PaginationDto는 cursor 기반으로 전환 또는 신규 CursorPaginationDto 도입

### 인증 흐름 영향

- `AuthGuard`: AccessToken sub를 BIGINT로 파싱
- `@AuthenticatedUserValidation()` 데코레이터: 주입 타입을 BIGINT로 변경
- 기존 발급된 JWT 토큰은 무효화 (Phase 1 머지 시점). 클라이언트가 재로그인 필요

## 의존 방향 영향

- blog → user: Post 작성자 확인 시 user 모듈의 Repository를 import (단방향 유지)
- user 모듈은 blog를 import하지 않음 (양방향 의존 금지 — common/application-arch.md §모듈 간 의존 제약)

## ErrorCode 추가

Phase 1에 신설:
- `COMMON_TOO_MANY_REQUESTS` (90xxx 영역) — Rate Limit 429 응답 (security-deployment.md 참조)

Phase 1에 신규 도메인 ErrorCode (Comment/Reply 도메인 32xxx 영역):
- 본 Phase 진입 시 ErrorCode enum에 Comment/Reply 도메인 추가 (BaseException 하위 디렉토리에 도메인별 Custom Exception 클래스 생성)

## 보안 리팩토링 (security-deployment.md 상세)

본 arch-increment는 IDOR 방어 Service 레이어 리팩토링·@nestjs/throttler 등록·로그인 실패 카운트 도입 위치를 명시하되, 구현 절차 상세는 security-deployment.md 참조.

## 테스트 영향

- 인증 흐름 E2E 재작성 필수: 기존 uid 기반 → userId 기반
- 새 도메인(Comment/Reply) Service 유닛 테스트 추가
- IDOR 방어 E2E 테스트 케이스 추가 (타 사용자 리소스 수정/삭제 시 403/404)
- Rate Limit E2E 테스트 (분당 N회 초과 시 429)
- Idempotency-Key 헤더 E2E 테스트 (동일 키 재요청 시 원본 응답 반환)

## Sources

- ../common/application-arch.md §Aggregates / §채택 패턴
- ../common/data-design.md §스키마 (최종 형상)
- ../common/security.md §2 인가 / §5 Rate Limiting / §7 침해 대응 알림 / §8 API Idempotency-Key
- data-migration.md (User Aggregate 재설계 단계 절차)
- security-deployment.md (Phase 1 보안 강화 구현 절차)
