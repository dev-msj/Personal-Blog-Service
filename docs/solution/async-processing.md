# Async Processing

## 소유권 경계

이 파일은 이벤트 발행/수신 정책, Saga coordinator(미적용), 메시지 큐 파이프라인, 이벤트 순서 보장, 이벤트 수신 측 Idempotency, DLQ, 재처리 전략, 실패 모드 대응을 다룬다.

- outbox 테이블 DDL / 이벤트 스키마 DDL / processed_events 테이블 DDL → data-design.md
- API 수신 Idempotency-Key 헤더 정책 → security.md
- 이벤트 로그 포맷 / 분산 추적 / Consumer lag 알림 채널 → observability.md
- 메시지 큐 인프라(Kafka/Redis 브로커 네트워크·배포) → infra-network.md (미적용 — 로컬 Docker Compose)
- FMEA 실패 모드 우선순위 → risk-analysis.md (미적용)

## 1. 동기/비동기 분류

### 1.1 UC별 분류

**결정**: UC별 분류는 다음과 같다 [확정]

| UC | 분류 | 비동기 전환 대상 이벤트 |
|---|---|---|
| UC-1 회원가입 | 혼합 | UserRegistered (부가 처리 없음, 향후 트리거 기록용) |
| UC-2 로그인 | 혼합 | UserLoggedIn (향후 활동 이력 집계) |
| UC-3 Google OAuth | 혼합 | UserRegistered + OAuthProviderLinked |
| UC-4 토큰 갱신 | 동기 | TokenRotated (감사 용도, 필수는 아님) |
| UC-5 글 상세 조회 | **혼합 핵심 사례** | PostViewed → **hits 비동기 집계** (동기 응답에서 제거) |
| UC-6 좋아요/취소 | **혼합 핵심 사례** | PostLiked/PostUnliked → **좋아요 카운트 캐시 갱신** |
| UC-7 글 목록 조회 | 동기 | 비동기 대상 없음 (조회 경로, 캐시 사용) |
| 댓글 작성 (Phase 1 신규) | 혼합 | CommentCreated → **알림 비동기 발송** |
| 답글 작성 (Phase 1 신규) | 혼합 | ReplyCreated → **댓글 작성자 + Post 작성자 알림 발송** |

**근거**: BP1 비동기 시스템 적용 + TP1 + Forces F1(응답성 vs 완결성) + Vernon Rule 4(경계 밖 일관성은 eventual)

**기각 대안**: (1) 전면 비동기 — 로그인/토큰 갱신 같은 즉시 응답 UC에 부적합. (2) 전면 동기 — BP1 학습 목표 미달성

**파급 효과**:
- UC-5 hits 집계가 요청 트랜잭션에서 제거되면 응답 latency 단축 (Phase 4 측정 대상)
- 알림 발송이 비동기 큐로 분리되어 댓글/답글 응답 시간이 알림 인프라 상태에 비종속
- 집계/알림 작업은 실패 가능성을 전제하고 재시도 로직 필수

### 1.2 혼합 UC의 경계 원칙

**결정**: 핵심 트랜잭션(사용자 응답에 필요한 상태 변경)은 동기. 부가 효과(집계·알림·감사)는 이벤트 발행으로 분리 후 consumer가 비동기 처리 [확정]

**근거**: Vernon Rule 1(Aggregate 내부 강일관성) + Rule 4(경계 밖 eventual). 이벤트 발행은 원본 트랜잭션과 **Transactional Outbox 패턴**(§3.4)으로 원자적 결합

**기각 대안**: Direct publish (트랜잭션 커밋 후 직접 발행) — 발행 실패 시 이벤트 누락. 복구 불가능

**파급 효과**: 모든 비동기 이벤트 발행은 outbox를 거친다. outbox relay worker가 Kafka에 발행 후 `published_at` 업데이트. observability.md는 outbox 적체량(published_at IS NULL 건수)을 alert 대상으로 추가 필요

## 2. Saga 설계

### 2.1 Saga 미적용 결정

**결정**: 이 프로젝트 Phase 3 범위에서 Saga 패턴 미적용 [확정]

**근거**:
- Patterns Selection 2.5.0 사전 판단 — Forces 미존재
- 현재 도메인의 모든 Write UC가 단일 Aggregate 경계 내에서 완결:
  - OAuth 가입: User Aggregate 내부(User + UserAuth + UserInfo + UserAuthProvider 단일 트랜잭션)
  - 글/댓글/답글/좋아요: Post Aggregate 내부
- 외부 서비스 호출이 트랜잭션 경계를 넘는 UC 부재 (Google OAuth는 ID Token 검증 후 단발 종료)

**기각 대안**:
- (1) 인위적 Saga 시나리오 도입(예: 외부 결제/이메일 서비스) — 도메인 왜곡으로 학습 가치 상실. Saga 학습은 별도 프로젝트에서 적합
- (2) 사용자 삭제 cascade를 Choreography로 분해 — 이미 DB-level CASCADE(application-arch.md §Post Aggregate 파급 효과의 학습 프로젝트 예외)로 처리됨. 동일 목적의 패턴 중복

**파급 효과**: Saga coordinator / 보상 트랜잭션 / Saga 타임아웃 / Saga 상태 저장소 결정 모두 해당 없음. 향후 도메인 확장(외부 결제·이메일 서비스 도입, 멀티 BC 분화 등) 트리거 발생 시 별도 Phase에서 재검토

## 3. 메시지 큐 파이프라인

### 3.1 브로커 선정

**결정**: **BullMQ (작업 큐) + Kafka (이벤트 스트리밍)** 동시 채택. 각 용도 분리 [확정]

| 브로커 | 용도 | 대표 사례 |
|---|---|---|
| BullMQ (Redis Streams 기반) | 단순 비동기 작업, 즉시 실행/1회 처리, Rate Limiting 필요한 작업 | 알림 발송(SendNotification job), 이메일 발송, 외부 API 호출 래퍼 |
| Kafka (KRaft 모드) | 도메인 이벤트 스트리밍, 여러 consumer 구독, 장기 보존, 순서 보장 | PostViewed / PostLiked / CommentCreated / ReplyCreated 등 도메인 이벤트. 집계 consumer + 알림 발행 consumer + 감사 로그 consumer 등 구독 가능 |

**근거**:
- BP1 학습 목표 "cache, queue, redis, kafka" 모두 경험 — 작업 큐 패러다임과 이벤트 스트리밍 패러다임을 **분리 학습**
- BullMQ: context.md [기술 스택 제약] 기존 Redis 스택 활용 + `@nestjs/bullmq` 공식 통합 + 업계 NestJS 표준(2024+) + 기능 완비(우선순위 / 지연 / 반복 / Rate Limiting / Failed Jobs)
- Kafka: BP1 명시 학습 대상 + Confluent/Apache 공식 문서 + Kleppmann "Designing Data-Intensive Applications" (2017) Ch.11 이벤트 스트리밍 표준

**기각 대안**:
- Bull (legacy `@nestjs/bull`): 유지보수 모드, 공식 문서에서 신규 프로젝트 BullMQ 권장
- Kafka only: 작업 큐 전용 기능(우선순위/반복/Rate Limiting) 부재로 "단순 백그라운드 작업"에 과도한 인프라. BullMQ 학습 누락
- BullMQ only: Kafka 학습 목표 미달
- RabbitMQ: Redis 이미 있는데 추가 브로커 → 인프라 중복. 작업 큐 전용 편의성은 BullMQ 우위
- AWS SQS: 관리형 서비스, 로컬 Docker Compose 환경 부적합, 클라우드 out-of-scope
- Agenda: MongoDB 기반, 현 스택(MySQL + Redis) 불일치
- Redis Pub/Sub 직접 구현: Job lifecycle / retry / DLQ 자체 구현 부담, 바퀴 재발명

**파급 효과**:
- infra-network Extension 미적용이나 docker-compose.yaml에 Kafka (KRaft 모드) 컨테이너 추가 필요 (Phase 3.3 진입 시)
- observability.md: Consumer lag 메트릭 수집 대상이 BullMQ 큐 + Kafka 토픽 2곳으로 분리
- data-design.md: outbox 테이블, processed_events 테이블 신설 (§3.4, §6.1)
- Phase 3 진입 시점에 3단계 도입 순서를 Problem 재작성으로 확정

### 3.2 토픽/큐 구조

**결정**: [확정]

**Kafka 토픽**:
- `user.events` — User Aggregate 이벤트 (UserRegistered, UserLoggedIn, OAuthProviderLinked, TokenRotated, UserInfoUpdated, UserDeleted)
- `post.events` — Post Aggregate 이벤트 (PostCreated, PostUpdated, PostDeleted, PostViewed, PostLiked, PostUnliked, CommentCreated/Updated/Deleted, ReplyCreated/Updated/Deleted)
- `user.events.DLQ`, `post.events.DLQ` — 각 토픽의 DLQ

**BullMQ 큐**:
- `notification` — 알림 발송 작업 (SendNotification)
- `email` — 이메일 발송 작업 (향후)
- 각 큐는 BullMQ 내장 Failed Jobs로 DLQ 역할 대체

**명명 규약**: `<aggregate>.events` (도메인 이벤트) / `<purpose>` (작업 큐)

**파티션 수**: Kafka 토픽당 3개 (학습 목표 — 병렬 처리 경험 + 순서 보장 관찰)

**근거**: Aggregate 경계 기반 토픽 분리 (Vernon Rule 4 + Kleppmann Ch.11 "Topic per entity type"). 내부/퍼블릭 분리는 학습 프로젝트 규모에서 과잉

**기각 대안**:
- 이벤트 타입별 토픽 세분화(`post.created`, `post.liked` 등) — 토픽 수 폭증, 순서 보장 주제(같은 Aggregate 이벤트가 여러 토픽에 분산) 이슈
- 단일 `all.events` 토픽 — 파티션 키 설계 복잡, 토픽별 보존/권한 분리 어려움

**파급 효과**: 이벤트 추가 시 토픽은 기존 유지. 새 이벤트 타입은 `event_type` 필드로 구분. consumer는 구독 토픽 내 `event_type` 필터링으로 처리

### 3.3 Consumer 그룹 전략

**결정**: [확정]

- Consumer 그룹명 = `<service>.<purpose>` 형식
  - 예: `blog-service.hits-aggregator` (PostViewed 소비 → hits UPDATE)
  - 예: `blog-service.like-counter` (PostLiked/PostUnliked 소비 → 좋아요 카운트 캐시)
  - 예: `blog-service.notification-publisher` (CommentCreated/ReplyCreated 소비 → BullMQ notification 큐에 작업 enqueue)
- ACK 방식: **manual ack** (auto-commit 비활성화). 처리 성공 후 명시 커밋
- 리밸런싱 정책: Sticky Assignor (파티션 재분배 최소화)

**근거**: Kafka 공식 "Consumer Groups" + 학습 프로젝트에서 각 consumer를 독립 처리 단위로 분리하면 관찰/디버깅 용이

**기각 대안**: Auto-commit — 처리 중 예외 시 메시지 소실 위험. 학습 관찰성 저하

### 3.4 발행 보장 — Transactional Outbox

**결정**: Transactional Outbox 패턴 채택. outbox 테이블에 이벤트를 원본 트랜잭션과 동일 트랜잭션으로 INSERT → 별도 relay worker가 polling 또는 Debezium CDC로 Kafka 발행 [확정]

**근거**:
- TP1 + Forces F1 + Hohpe & Woolf "EIP" (2003) Transactional Outbox + Richardson "Microservices Patterns" (2018)
- Direct publish(commit 후 직접 Kafka 발행)는 commit 성공 + 발행 실패 시 이벤트 누락. 복구 불가능
- outbox는 DB 원자성을 이용해 발행 보장(at-least-once)

**기각 대안**:
- Direct publish — 위 이벤트 누락 위험
- Debezium CDC (MySQL binlog 읽기) — 인프라 복잡도 큼, 학습 프로젝트 스코프 대비 과다. 다만 후속 확장 여지로 기록

**파급 효과**:
- data-design.md `outbox` 테이블 신설 필요 (§3 Phase 3 스키마 진화에 이미 선언됨)
- outbox 스키마: `event_id UUID PK, aggregate_type, aggregate_id, event_type, schema_version, occurred_at, payload JSON, published_at NULLABLE, publish_attempts INT, sequence_number`
- Relay worker 구현: Phase 3.3에서 별도 process(NestJS schedule 기반 polling, 1초 간격) 또는 독립 워커로. 정확한 구현 방식은 Phase 3 진입 시점 재검토

### 3.5 Backpressure

**결정**: [확정]

- **Kafka**: Consumer lag 임계값 `파티션당 1000건` 초과 시 Alert 발행 (관측성 연계). 구조적 해결은 consumer 수 증가(파티션 수 범위 내) 또는 처리 로직 최적화
- **BullMQ**: 큐 길이 임계값 `1000건` 초과 시 Alert. Rate Limiting으로 downstream 보호 (예: notification 큐 = 초당 100건 상한)

**근거**: Nygard "Release It!" 2e Bulkhead + Backpressure

**파급 효과**: observability.md에서 해당 알림 채널 구체화

## 4. 이벤트 계약

### 4.1 이벤트 인벤토리

application-arch.md §Aggregates Command→Event 매핑 기반 전수 목록.

**User Aggregate 이벤트** (`user.events` 토픽):
- `UserRegistered { userId, registeredAt, registrationSource: "local" | "google" }`
- `UserLoggedIn { userId, loggedInAt, loginMethod }`
- `OAuthProviderLinked { userId, provider, providerSubject, linkedAt }`
- `TokenRotated { userId, rotatedAt }`
- `UserInfoUpdated { userId, changedFields: string[], updatedAt }`
- `UserDeleted { userId, deletedAt }`

**Post Aggregate 이벤트** (`post.events` 토픽):
- `PostCreated { postId, authorUserId, createdAt }`
- `PostUpdated { postId, updatedAt }`
- `PostDeleted { postId, deletedAt }`
- `PostViewed { postId, viewerUserId, viewedAt }` — **hits 집계 대상**
- `PostLiked { postId, userId, likedAt }` — **좋아요 카운트 캐시 갱신 대상**
- `PostUnliked { postId, userId, unlikedAt }`
- `CommentCreated { commentId, postId, commentAuthorId, postAuthorId, createdAt }` — **알림 발행 대상**
- `CommentUpdated { commentId, updatedAt }`
- `CommentDeleted { commentId, deletedAt }`
- `ReplyCreated { replyId, commentId, replyAuthorId, commentAuthorId, postAuthorId, createdAt }` — **알림 발행 대상**
- `ReplyUpdated { replyId, updatedAt }`
- `ReplyDeleted { replyId, deletedAt }`

**BullMQ 작업 유형** (`notification` 큐):
- `SendNotification { recipientUserId, type: "comment" | "reply" | ..., payload: {...}, triggeredByEventId }`

### 4.2 페이로드 구조

**결정**: 모든 Kafka 이벤트는 공통 envelope + 도메인 payload + 관측성 _meta 구조 [확정]

```json
{
  "event_id": "UUID v4",
  "event_type": "PostLiked",
  "schema_version": 1,
  "occurred_at": "ISO8601 timestamp",
  "aggregate_type": "Post",
  "aggregate_id": "42",
  "sequence_number": 137,
  "payload": {
    "postId": 42,
    "userId": 123,
    "likedAt": "..."
  },
  "_meta": {
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
    "traceparent": "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    "tracestate": ""
  }
}
```

**필드 의미**:
- `event_id`: 멱등 키 (§6.1)
- `event_type`: 이벤트 종류 식별. consumer 라우팅 기준
- `schema_version`: 페이로드 스키마 버전. Breaking 변경 시 증가 (§4.4)
- `occurred_at`: 이벤트 발생 도메인 시각
- `aggregate_type`, `aggregate_id`: 파티션 키 산출 (§5.2)
- `sequence_number`: Aggregate 내 이벤트 단조 증가 번호 (§5.3)
- `payload`: 이벤트 고유 데이터
- `_meta`: 관측성 컨텍스트. observability.md §1.4 (correlation_id) + §3.4 (W3C Trace Context: traceparent / tracestate) 정합. Outbox INSERT 시점에 원본 트랜잭션의 컨텍스트를 캡처하여 채움. Relay Worker가 Kafka publish 시 traceparent를 Kafka message header `x-correlation-id` / `traceparent`로도 미러링하여 consumer 측 자동 추출 가능. Consumer는 _meta 필드를 읽어 자체 AsyncLocalStorage / Span context 복원

**BullMQ 작업**은 JSON object로 payload 전달 (BullMQ 내부 프로토콜이 envelope 제공). `triggeredByEventId` 필드로 발생 Kafka 이벤트 추적 (관측성 연계)

**근거**: Kleppmann DDIA Ch.4 "Schemas and the evolution of data" + CloudEvents 스펙 (v1.0)과 유사 구조

**기각 대안**: CloudEvents 스펙 엄격 준수 — 학습 프로젝트 스코프에서 필드 네이밍 표준 준수 가치 낮음. 핵심 구조만 채택

### 4.3 인코딩 / 스키마 레지스트리

**결정**: **JSON 인코딩**, Schema Registry 미사용. 스키마는 `src/events/schemas/*.json` 또는 TypeScript 인터페이스로 관리 [확정]

**근거**:
- 학습 프로젝트 규모 — Confluent Schema Registry 운영 부담 과다
- JSON은 TypeScript 네이티브 지원, 디버깅 용이 (k6 스크립트에서도 이벤트 검증 가능)
- TypeScript 인터페이스로 producer/consumer 양쪽 타입 공유 (동일 코드베이스)

**기각 대안**:
- Avro + Confluent Schema Registry — 운영 복잡도, 학습 프로젝트 과다
- Protocol Buffers — 학습 가치는 있으나 JSON 대비 디버깅 난이도 증가

**파급 효과**: 메시지 크기가 JSON 대비 Avro/Protobuf보다 큼. Phase 4 부하 테스트에서 네트워크/디스크 영향 관찰 대상

### 4.4 호환성 정책 및 Breaking 변경 절차

**결정**: [확정]

- **기본 정책**: backward compatibility. 필드 추가는 optional로 하고 기존 consumer 동작 무관 보장
- **Breaking 변경 시**: 기존 이벤트 타입 유지 + 신규 이벤트 타입(v2 suffix 또는 새 이름) 추가 → consumer가 점진적 migration → 기존 이벤트 타입은 drain 후 제거
- **예시**: `PostLiked` 페이로드에 `source: "direct" | "notification-click"` 필드 추가 시 → 기존 consumer는 필드 무시, 신규 consumer만 활용 (backward)
- **파괴적 변경 예**: `PostLiked.userId`를 `PostLiked.likerUserId`로 rename → `PostLikedV2` 이벤트로 별도 발행 + consumer 이관 + 기존 제거
- **`_meta` 필드 추가 (Phase 2 관측성 도입 후)**: backward compatible. 기존 consumer는 _meta를 무시 가능하며 동작 무관. 관측성 활용 consumer만 _meta 추출 (observability.md §1.4·§3.4 정합)

**근거**: Kleppmann DDIA Ch.4 backward/forward compatibility + Confluent Schema Registry 공식 가이드

**기각 대안**: 엄격한 schema version 검증 + consumer 거부 — 운영 경직성. backward 정책이 학습·실무 균형 우위

### 4.5 Deprecated 이벤트 제거

**결정**: [가이드]

- Deprecated 표기 후 최소 2주 drain 기간
- 발행자(producer)는 표기 시점부터 새 이벤트만 발행, 구 이벤트는 발행 중지
- 모든 consumer가 처리 완료되었음을 observability로 확인 후 토픽/큐에서 제거
- 학습 프로젝트이므로 실제 제거 실행보다는 **drain 절차를 블로그 글감으로 기록** 가치 있음

**근거**: 학습 프로젝트 규모 관행

## 5. 이벤트 순서 보장

### 5.1 순서 요구 범위

**결정**: **Aggregate별 순서 보장** [확정]

- 전역 순서: 불필요 (Aggregate 간 독립 이벤트는 병렬 처리 가능)
- Aggregate 내 순서: 필수 (예: PostCreated → PostViewed → PostDeleted 순서가 역전되면 consumer 상태 일관성 깨짐)

**근거**: Vernon IDDD Ch.8 Aggregate 내 이벤트 순서 + Kafka 공식 "Partitions and consumer groups"

### 5.2 파티션 키 전략

**결정**: 파티션 키 = `aggregate_type + aggregate_id` [확정]

- `PostCreated { aggregate_type: "Post", aggregate_id: 42 }` → 파티션 키 = `Post:42` → 동일 partition
- 결과: 같은 Post의 모든 이벤트가 같은 파티션에 할당되어 consumer 내 순서 보장

**기각 대안**:
- `aggregate_id`만 — User와 Post의 동일 ID 충돌 가능성 (User.userId=42, Post.postId=42)
- Hash 기반 무작위 — 순서 보장 상실

### 5.3 sequence_number / gap 검출

**결정**: [확정]

- Aggregate별 이벤트 발행 시 단조 증가 `sequence_number` 부여 (outbox 테이블의 serial 또는 Aggregate 내 이벤트 시퀀스 컬럼)
- Consumer는 `(aggregate_type, aggregate_id, last_processed_sequence_number)`를 저장 — processed_events 테이블 또는 별도 consumer state 테이블
- Gap 검출: 수신 sequence_number > last_processed + 1이면 gap. **조치**: 관측성 alert 발행, 현재 메시지는 일단 처리 후 gap 원인 조사 (Kafka 재조립/재시도로 자연 해소되는 경우 대부분)

**근거**: Kleppmann DDIA Ch.11 "Total Order Broadcast" 유사 + 학습 프로젝트 관찰 가치

**기각 대안**: Gap 감지 시 consumer 중지 + 수동 개입 — 운영 부담 과다. 단순 alert가 학습 범위 적합

### 5.4 in-order consumer 설정

**결정**: [확정]

- Kafka: 파티션당 단일 consumer (consumer 수 ≤ 파티션 수 강제). 리밸런싱 시 sticky assignor로 파티션 이동 최소화
- BullMQ: 작업 큐는 순서 보장 불필요한 작업만 배치(알림 발송은 순서 중요치 않음). 순서 중요한 작업은 큐 분리 또는 Kafka 이벤트로 발행

### 5.5 순서 역전 허용 정책

**결정**: [가이드]

- `PostViewed` 집계: 동일 Post의 viewed 횟수가 순서대로 집계되지 않아도 최종 카운트만 정확하면 OK. 순서 역전 허용 (카운터 UPDATE 연산의 교환법칙)
- `PostLiked/PostUnliked`: 동일 (userId, postId) 쌍에 대해 좋아요 ON/OFF 상태 최종값이 정확해야 함. 순서 역전 시 상태 불일치 가능 → Aggregate별 순서 보장 필수 (§5.2 충족)
- `UserInfoUpdated`: 동일 userId의 업데이트 순서 역전 시 덮어쓰기 충돌 가능 → Aggregate별 순서 보장 필수

## 6. Idempotency (이벤트 수신 측)

**경계**: 이 섹션은 이벤트 수신 측의 중복 처리 방어를 다룬다. API 수신 시 클라이언트 제공 `Idempotency-Key` 헤더 처리는 security.md 참조 (§7 상호의존 경계).

### 6.1 멱등 키 규약

**결정**: **`event_id` (UUID v4)** 를 멱등 키로 사용 [확정]

- Kafka 이벤트: envelope의 `event_id` 필드가 멱등 키. producer가 발행 시 생성
- BullMQ 작업: Job ID(`SendNotification:<uuid>`)가 멱등 키 역할. 또는 `triggeredByEventId` 필드를 소비 측에서 검증

**근거**: Helland ACM Queue 2012 + IETF draft-ietf-httpapi-idempotency-key-header

**기각 대안**: `(aggregate_id, sequence_number)` — event_id보다 구성 복잡. event_id 단일 키가 단순성 우위

### 6.2 중복 검출 메커니즘

**결정**: **processed_events 테이블 + UNIQUE 제약** [확정]

- Consumer가 이벤트 처리 시작 전: `INSERT INTO processed_events (event_id, consumer_group, processed_at) ON DUPLICATE KEY IGNORE`
- UNIQUE 제약 충돌(이미 처리됨) → 중복 감지 경로로 진입
- DB 제약이 주된 방어선. Redis 캐시는 보조 수단으로 사용 가능 (고빈도 이벤트 대상)

스키마 상세는 data-design.md §processed_events 참조.

**근거**: Helland + DB 제약 우선 원칙(솔루션 단순성)

**기각 대안**:
- Redis SETNX만 사용 — Redis 장애 시 방어선 없음. DB 제약이 더 안정적
- 애플리케이션 레벨 Set 캐시 — Consumer 재시작 시 상태 소실

### 6.3 중복 감지 시 동작

**결정**: **조용히 ACK + 로그 기록** [확정]

- 중복 감지 시 Consumer는 메시지를 ACK하여 브로커에서 제거 (재시도 순환 방지)
- Warning 레벨 로그 기록 (metadata: event_id, consumer_group, 원본 처리 시각)
- Metric 카운터 증가 (observability.md alert 가능: 지속적 중복 발생 시 상위 이슈 탐지)

**근거**: Helland "중복을 자연 상태로 수용" 원칙

### 6.4 보존 기간

**결정**: **30일** [확정]

**근거**:
- checklist-async.md "DLQ 재시도 최대 기간 ≤ 중복 검출 보존 기간" 정합성 규칙
- §7.3 DLQ 보존 30일과 일치 — DLQ 재처리가 30일 내 언제든 가능하므로 Idempotency 레코드도 최소 30일 유지
- TTL은 `processed_at + INTERVAL 30 DAY` 기준, 별도 배치로 주기 삭제 (주 1회)

**기각 대안**:
- 7일 — DLQ 보존(30일)과 비정합, 재처리 시 중복 처리 위험 (**자가 검토에서 발견된 초기 기본값 위반**)
- 무기한 — 스토리지 증가. 학습 프로젝트라도 관찰 불필요

## 7. DLQ 정책 / 재처리 전략

### 7.1 전달 의미론

**결정**: **at-least-once** [확정]

- 메시지 최소 1회 처리 보장. 중복 처리 가능 (→ §6 Idempotency로 방어)
- Exactly-once(effective) 달성을 위한 조건: (Producer transaction + Consumer idempotent processing). 이 프로젝트에서 producer transaction은 Kafka transactions API로 부분 달성 가능하나 Phase 3 범위에서는 **at-least-once + Idempotency consumer**로 effective exactly-once 달성

**근거**: Kleppmann DDIA Ch.11 + Kafka 공식 "Delivery Semantics"

**기각 대안**:
- at-most-once — 메시지 소실 허용, 집계 정확성 저해
- exactly-once(strict) — Kafka transactions + 2PC 수준의 복잡도. 학습 프로젝트 과다

### 7.2 재시도 정책

**결정**: [확정]

- **공통**: 최대 재시도 3회, exponential backoff + jitter
- **Backoff**: 1초 → 4초 → 16초 (base=4, ±25% jitter)
- **Kafka**: Consumer 측에서 재시도 관리 (in-memory counter per event_id) 또는 retry 토픽 패턴. 학습 프로젝트는 **retry 토픽 미사용, Consumer 측 재시도** 선택 (단순성)
- **BullMQ**: 내장 `attempts: 3`, `backoff: { type: 'exponential', delay: 1000 }` 설정

**근거**: Nygard "Release It!" Retry + Jitter + AWS 공식 Exponential Backoff 가이드

**기각 대안**: 고정 간격 재시도 — thundering herd 위험. jitter 필수

### 7.3 DLQ 진입 조건 / 저장소

**결정**: [확정]

- **DLQ 진입 조건**: N회 재시도 실패 / JSON 파싱 실패 / Known non-retriable error (비즈니스 규칙 위반 등)
- **Kafka DLQ**: 별도 토픽 `<topic>.DLQ` (예: `post.events.DLQ`). 파티션 수 = 원본의 1/3 수준 (낮은 트래픽)
- **BullMQ DLQ**: 내장 Failed Jobs. 별도 토픽 불필요
- **보존 기간**: 30일 (§6.4 Idempotency 보존과 일치)

**근거**: AWS SQS DLQ 공식 가이드 + Confluent DLQ 패턴

### 7.4 재처리 진입점

**결정**: [확정]

- **DLQ 수동 재처리**: admin script 또는 관리 UI (Bull Board)로 DLQ의 Failed Job → 원본 큐로 re-enqueue
- **시간 범위 재처리**: Kafka는 consumer offset reset(`--to-datetime`)으로 과거 이벤트 재소비. 특정 consumer group만 reset하여 replay
- **Aggregate별 재처리**: 특정 aggregate_id의 이벤트만 재처리하는 전용 스크립트(학습 목적 개발). processed_events 테이블에서 해당 레코드 삭제 후 consumer offset reset

**근거**: Kafka "Reset consumer offsets" 공식 가이드 + 학습 프로젝트의 재처리 경험 가치

### 7.5 Poison Pill 격리

**결정**: [확정]

- **Kafka**: 동일 event_id가 DLQ에 연속 3회 이상 진입 (즉 총 9회 실패) → poison pill로 자동 격리. 격리 방식 = DLQ에서도 분리된 `poison` 토픽으로 이동 + Alert
- **BullMQ**: 동일 job이 Failed → Retry → Failed 순환 3회 이상 → poison으로 표시 + Retry 자동 차단
- **해제 절차**: 수동 개입. 근본 원인 수정 후 관리 UI에서 해제 → 원본 큐 재진입

**근거**: Nygard "Release It!" Bulkhead + "Fail Fast" 원칙

### 7.6 Runbook

**결정**: [가이드]

- DLQ 발생 시 Runbook (학습 프로젝트이므로 자체 작성):
  1. Alert 수신 → observability.md 대시보드 확인
  2. DLQ 내 메시지 샘플 추출 (Bull Board 또는 Kafka UI)
  3. 에러 원인 분류 (코드 버그 / 외부 의존 장애 / 데이터 이슈)
  4. 수정 배포 후 DLQ 재처리
  5. Post-mortem 기록 (Type B 블로그 소재)

## 8. 실패 모드 대응

### 8.1 실패 모드 인벤토리

**결정**: [확정]

| 실패 모드 | 감지 | 완화 |
|---|---|---|
| 이벤트 손실 | outbox `published_at IS NULL` 적체 알림 | Transactional Outbox로 구조적 방어 |
| 순서 뒤집힘 | sequence_number gap 감지 (§5.3) | Aggregate별 파티션 보장 (§5.2) |
| 중복 폭주 | 동일 event_id 재처리 카운터 급증 | Idempotency DB 제약 (§6.2) |
| Consumer lag 폭증 | Kafka lag metric / BullMQ 큐 길이 임계값 | Consumer 증설 / Rate Limiting (§3.5) |
| 브로커 단절 | Producer 연결 실패 / Consumer heartbeat 소실 | Circuit Breaker on producer / Consumer 자동 재접속 |
| Outbox relay 중단 | outbox 적체 급증 | Relay worker 헬스체크 + 자동 재시작 |
| DLQ 유입 속도 급증 | DLQ 메시지/초 임계값 | 수동 개입 Runbook (§7.6) 트리거 |

**근거**: Nygard Stability Patterns + 이 프로젝트 이벤트 흐름 특성

### 8.2 감지 시그널

**결정**: [확정]

- Consumer lag 임계값: 파티션당 1000건
- Outbox 적체: `published_at IS NULL AND created_at < NOW() - INTERVAL 1 MINUTE` 건수 > 100
- DLQ 유입: 토픽당 >10건/분
- Idempotency 중복률: 시간당 >5%

임계값의 구체 수치는 Phase 4 부하 테스트 이후 조정 가능 (관측 기반 튜닝).

### 8.3 알림 연계

**결정**: 상세는 observability.md §알림 채널 참조 [가이드]

포인터만: 상기 감지 시그널 각각이 관측성 alert 채널(이메일/Slack/로그 등)로 라우팅된다. 채널 선정·임계값·escalation 정책은 observability Extension 소관.

### 8.4 FMEA 연계

**결정**: 해당 없음 [가이드]

근거: risk-analysis Extension 미적용 (problem.md Out-of-scope + Core Extension 생성 계획). 안전 중대/고가용성/규제 도메인 아님.

### 8.5 Graceful Shutdown

**결정**: [확정]

- **SIGTERM 수신 시**:
  1. 새 메시지 fetch 중지 (Kafka consumer.pause() / BullMQ worker.pause())
  2. 현재 처리 중(in-flight) 메시지의 ACK 완료 대기
  3. 최대 30초 타임아웃. 초과 시 강제 종료 + Warning 로그
- **재시작 시**:
  - Kafka: 마지막 커밋된 offset부터 resume (at-least-once 보장)
  - BullMQ: 처리 중이던 job은 stalled 상태가 되어 자동 재시도 (BullMQ 내장)

**근거**: 12-Factor App IX (Disposability) + NestJS 공식 Graceful Shutdown 가이드 (`app.enableShutdownHooks()`)

## 대표 처리 흐름도

### 흐름 1: 글 상세 조회 + hits 비동기 집계 (Phase 3 대표)

```
Client → GET /posts/42
  AuthGuard 검증
  PostController.getPost
  PostService.findOne(postId=42)
    Repository.findOne        // 동기 조회
  [트랜잭션 시작]
    outbox INSERT {
      event_id: uuid,
      event_type: "PostViewed",
      aggregate_type: "Post",
      aggregate_id: 42,
      sequence_number: N,
      payload: { postId: 42, viewerUserId: 123, viewedAt: ... }
    }
  [트랜잭션 커밋]
  응답 반환  ← 사용자 대기 종료 (hits 증가 이전)

--- 비동기 경로 ---

Outbox Relay Worker (별도 process, 1초 polling)
  SELECT * FROM outbox WHERE published_at IS NULL ORDER BY id LIMIT 100
  → Kafka producer.send("post.events", envelope)
  → outbox UPDATE published_at = NOW()

Kafka `post.events` 토픽 (파티션: hash("Post:42") % 3)

blog-service.hits-aggregator consumer group
  consume PostViewed
  processed_events 중복 검증 (event_id UNIQUE)
  UPDATE post SET hits = hits + 1 WHERE post_id = 42
  ACK
```

### 흐름 2: 댓글 작성 → 알림 비동기 발송

```
Client → POST /posts/42/comments
  CommentController.createComment
  CommentService
    Idempotency-Key 검증 (security.md §API Idempotency)
  [트랜잭션 시작]
    INSERT INTO comment (...)
    outbox INSERT { event_type: "CommentCreated", aggregate_id: 42, payload: {...} }
  [트랜잭션 커밋]
  응답 반환

Outbox Relay Worker → Kafka `post.events`

blog-service.notification-publisher consumer group
  consume CommentCreated
  processed_events 중복 검증
  BullMQ queue.add("SendNotification", {
    recipientUserId: postAuthorId,
    type: "comment",
    payload: { commentId, postId, commentAuthorId },
    triggeredByEventId: event_id
  })
  Kafka ACK

BullMQ `notification` 큐 worker
  job 처리: 실제 알림 채널(이메일/푸시/DB 저장) 호출
  실패 시 재시도 3회
  성공 시 job completed
```

## Sources

- docs/context.md
- docs/problem.md (BP1, TP1, UC-5/6 및 Phase 1 신규 UC)
- docs/solution/overview.md, application-arch.md (Command→Event 매핑 전수)
- docs/solution/data-design.md (Phase 3 outbox / processed_events 스키마 선언)
- docs/meeting-logs/2026-04-24.md
- ~/.claude/skills/mcpsi-solution/references/checklist-async.md (Saga/DLQ/순서/Idempotency/재처리/스키마/실패 모드 7개 섹션)
- ~/.claude/skills/mcpsi-solution/references/checklist-common.md (외부 서비스 회복력, Graceful Shutdown)
- 방법론 근거:
  - Garcia-Molina & Salem "Sagas" (SIGMOD 1987) — 미적용 결정 근거
  - Richardson "Microservices Patterns" (2018) Ch.4
  - Hohpe & Woolf "Enterprise Integration Patterns" (2003) — Transactional Outbox, Publish-Subscribe
  - Kleppmann "Designing Data-Intensive Applications" (2017) Ch.4 + Ch.8 + Ch.11
  - Helland "Idempotence is Not a Medical Condition" (ACM Queue 2012)
  - Nygard "Release It!" 2nd ed. Stability Patterns
  - Vernon "IDDD" (2013) Ch.8
  - Kafka 공식 문서 (Partitions, Consumer Groups, Delivery Semantics, KRaft)
  - 12-Factor App IX (Disposability)
  - NestJS 공식 문서 (Queues — @nestjs/bullmq), BullMQ 공식 문서
