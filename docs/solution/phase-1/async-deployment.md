# Phase 1 Async Deployment

본 Phase에서 적용하는 async 관련 결정. **본격적인 비동기 인프라(Outbox, Kafka, BullMQ, notification 모듈)는 Phase 3에 위임**한다. Phase 1은 API 수신 측 Idempotency-Key 헤더 적용에 한정된다.

정책 primary는 ../common/async.md (이벤트 수신 측 Idempotency 관련 측면) 및 ../common/security.md §8 (API 수신 측 Idempotency-Key 헤더).

## API 수신 측 Idempotency-Key 적용

### 대상 엔드포인트

Phase 1 신설/리팩토링 Write API 전수:
- `POST /posts` — 글 작성
- `PATCH /posts/:postId` — 글 수정
- `DELETE /posts/:postId` — 글 삭제
- `POST /posts/:postId/likes` — 좋아요
- `DELETE /posts/:postId/likes` — 좋아요 취소
- `POST /posts/:postId/comments` — 댓글 작성
- `PATCH /posts/comments/:commentId` — 댓글 수정
- `DELETE /posts/comments/:commentId` — 댓글 삭제
- `POST /posts/comments/:commentId/replies` — 답글 작성
- `PATCH /posts/comments/:commentId/replies/:replyId` — 답글 수정
- `DELETE /posts/comments/:commentId/replies/:replyId` — 답글 삭제
- `PATCH /users/info` — 프로필 수정
- `DELETE /users/info` — 프로필 삭제

읽기 API(GET)는 미적용.

### 구현 절차

1. Idempotency 처리용 Interceptor 또는 Guard 신설 (`src/interceptor/idempotency-key.interceptor.ts`)
2. 요청 진입 시 `Idempotency-Key` 헤더 검사 (UUID v4 형식 검증)
3. Redis GET `idempotency:{user_id}:{idempotency_key}`:
   - 값 존재 + completed → 원본 응답 재반환 (statusCode + responseBody 복원)
   - 값 존재 + pending → 409 Conflict + `Retry-After: 5` 헤더
   - 값 없음 → Redis SETNX로 pending 상태 저장 → 핸들러 진행 → 완료 후 completed 상태로 UPDATE
4. TTL 24시간 (`EXPIRE 86400`)
5. 미인증 요청은 user_id 부재 → 일시적으로 IP 기반 키(`idempotency:ip:{ip}:{key}`)로 대체 또는 정책상 미적용

### Phase 1 범위 외 (Phase 3 위임)

- 도메인 이벤트(`PostViewed`, `CommentCreated` 등) Outbox INSERT
- Kafka producer/consumer 설정
- BullMQ notification 큐 설정
- Transactional Outbox relay worker
- 이벤트 수신 측 Idempotency (processed_events 테이블)
- Saga, DLQ, sequence_number gap 검출

위 항목은 Phase 3 진입 시 phase-3/async-deployment.md (또는 동등 파일)에서 도입.

### Comment/Reply 이벤트 발행 준비 (Phase 3에 비활성)

Phase 1에서 Comment/Reply 도메인 신설 시 application-arch.md의 Command→Event 매핑은 정의되어 있지만, **Phase 1에서는 이벤트를 실제 발행하지 않는다.** Service 레이어는 DB INSERT/UPDATE만 동기 수행. Phase 3 진입 시 동일 Service에 Outbox INSERT 로직을 추가하는 형태로 확장.

이는 Phase 3 진입 시점에 일관된 Outbox 도입을 위한 의도적 보류이며, Phase 1에서 partial 이벤트 발행 도입은 이벤트 계약 일관성 상실 위험 (../common/application-arch.md §EDA 기각 대안 (2) 참조).

## Sources

- ../common/async.md §1 동기/비동기 분류 (UC별 분류 표 — Phase 1 신규 UC 포함)
- ../common/security.md §8 API 수신 측 Idempotency-Key 헤더
- ../common/data-design.md §Redis 키 구조 (`idempotency:{user_id}:{idempotency_key}`)
