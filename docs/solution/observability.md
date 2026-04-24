# Observability

## 소유권 경계

이 파일은 다음 주제의 primary 파일이다:

- 로그 (구조화 포맷, 레벨 정책, PII 마스킹, 출력/수집/보존)
- 메트릭 (RED + USE, 비즈니스 메트릭, SLI/SLO/Error Budget, Consumer lag, Outbox 적체)
- 트레이싱 (OpenTelemetry, W3C Trace Context, 샘플링, async 경로 전파)
- Correlation ID 전파 구현 (Interceptor + AsyncLocalStorage 패턴의 구현 세부)
- 운영 알림/경보 (SLO 위반, 에러율, Consumer lag, Outbox 적체, DLQ 유입 — 일반 운영 시그널)
- 감사 로그 (audit_log 테이블 정책 — 대상 이벤트, 스키마, 무결성, 보존, 접근 제어)
- k6 부하 테스트 결과의 관측성 통합 방침
- 에러 처리와 로깅 표준의 프로젝트 특화 규칙

다른 파일이 primary인 주제의 포인터:
- 침해 대응 알림 시그널(로그인 실패 카운트, 권한 거부 급증, refresh token DB 불일치 등)의 발생 조건·임계값 → security.md §7. observability.md는 이를 수신해 알림 채널·전송 방식·억제 규칙만 실체 기술
- 이벤트 수신 측 Idempotency / Saga / DLQ / 실패 모드의 발생 조건 → async-processing.md §6·§7·§8. observability.md는 수집 메트릭·임계값·알림 라우팅만 실체 기술
- 이벤트 envelope 스키마(`event_id`, `schema_version`, `aggregate_id`, `sequence_number`) 정의 → async-processing.md §4 이벤트 계약. observability.md는 수집/저장/조회 방침만 실체 기술
- audit_log 테이블의 DDL → data-design.md §Phase 2 audit_log (정책 primary는 이 파일)
- 배포 파이프라인 알림 / 환경 변수 관리 → environment.md (미적용 — 로컬 POC, 본 프로젝트는 GitHub Actions main.yml 1건의 단순 워크플로우만 존재)
- Correlation ID 전파의 패턴 채택 결정([확정]) → application-arch.md §채택 패턴. observability.md는 구현 세부(헤더 이름, 생성 규칙, AsyncLocalStorage 키, Winston formatter 등) 담당

## 0. 적용 범위 및 SLO 입력

### 0.1 적용 범위 — 학습 프로젝트 기준 적용

**결정**: 본 프로젝트는 로컬 POC 단계임에도 observability를 적용한다 [확정]

**근거**: BP4(시스템 관측성 부재로 비동기화 성과 측정 불가) + TP6 + Phase 2 확정 범위. 적용 결정은 "프로덕션 배포 여부"가 아니라 "비동기화/부하 테스트 효과를 정량화할 수 있는가"를 기준으로 함. context.md [성공 지표 3] "관측성이 없으면 비동기화 성과를 측정할 수 없고 튜닝의 대상 지점도 확정 불가"

**기각 대안**: (1) 관측성을 클라우드 배포 트리거 시점으로 연기 — Phase 3 비동기화 효과 측정 불가, BP1·BP2 학습 목표 미달성. (2) 단순 Winston 로그만 유지 — 메트릭/트레이싱 학습 누락, AntiPattern Blind Faith 해소 실패

**파급 효과**: 로컬 Docker Compose에 Grafana LGTM 스택(Loki + Grafana + Tempo + Prometheus) 컨테이너 추가. 자원(메모리·CPU) 소비 증가는 관측 오버헤드로 수용. 부하 테스트 시 관측 오버헤드 자체도 측정 대상

### 0.2 SLO/SLA 입력 — 미명시, [가이드] 분류로 연기

**결정**: SLO/SLA 수치는 현 시점 미정의 [가이드]. Phase 4 부하 테스트 baseline 수립 후 확정

**근거**: context.md [알려진 불확실성 3] "부하 테스트 목표 규모 및 수치 기준 — Solution 단계 또는 별도 검토" + problem.md Phase 4 진입 시점에 "목표 규모 가정 확정" 절차 명시 + Google SRE Workbook Ch.2 "SLO 정의는 측정 데이터 위에서 합의" 원칙 (베이스라인 없는 SLO는 임의 수치)

**Phase 4 진입 시 결정 항목**:
- 가용성 SLO (목표 예: 99.5% / 30일 윈도우)
- p99 latency SLO (엔드포인트별 또는 카테고리별)
- Error rate SLO (성공/실패 비율)
- Error Budget 정책 (소진 시 기능 추가 동결 여부 — 학습 프로젝트라 형식적 적용)

본 파일 §2.4 SLI/SLO/Error Budget는 측정 대상 SLI 목록과 측정 방법만 [확정]으로 기술하고, 임계값은 [가이드]로 보류한다.

## 1. 로그 (Logging)

### 1.1 [확정] 로그 포맷 — 구조화 JSON

**결정**: 모든 로그는 구조화 JSON. 필수 필드 12개 [확정]

```json
{
  "timestamp": "2026-04-25T10:00:00.123Z",
  "level": "info",
  "service": "personal-blog-service",
  "version": "0.0.1",
  "env": "development",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "trace_id": "0af7651916cd43dd8448eb211c80319c",
  "span_id": "b7ad6b7169203331",
  "user_id": 123,
  "method": "GET",
  "path": "/posts/42",
  "event": "request.completed",
  "duration_ms": 47,
  "context": { "postId": 42, "hits": 1024 }
}
```

**필수 필드 의미**:
- `timestamp`: ISO 8601 UTC, 밀리초 정밀도 (`DATETIME(3)` 정합)
- `level`: `debug` | `info` | `warn` | `error` | `fatal` (winston 기본 레벨 사용)
- `service`: 고정 `personal-blog-service` (단일 모노리스). Outbox Relay Worker · Notification Worker도 동일 (모듈 구분은 `event` 또는 `context.module`로)
- `version`: `package.json` version 자동 주입
- `env`: `NODE_ENV` 값
- `correlation_id`: 요청 단위 식별자. Phase 2 §1.4 Correlation ID 전파 참조
- `trace_id`, `span_id`: OpenTelemetry context (없으면 생략 허용)
- `user_id`: 인증된 사용자(있을 때만). 미인증/공개 엔드포인트는 생략
- `method`, `path`: HTTP 컨텍스트(요청 단위 로그만)
- `event`: 이벤트 명. snake_case + `.` 계층 (예: `request.completed`, `outbox.published`, `notification.sent`)
- `duration_ms`: 처리 시간(있을 때만)
- `context`: 자유 필드. PII 마스킹 적용 후 (§1.3)

**근거**: TP6 + 12-Factor App XI (Logs as event streams) + OpenTelemetry Logs Data Model + nest-winston 공식 권장 + Loki 라벨 인덱싱 효율 (구조화 필드 → label 추출 가능)

**기각 대안**: (1) 평문 메시지 + 부가 데이터 — Loki/CloudWatch에서 검색·집계 비효율. (2) Pino 전환 — Winston 기존 사용 중, 전환 비용 학습 가치 낮음. Pino 성능 우위는 학습 규모에서 의미 미미

**파급 효과**:
- Winston `format.json()` + 커스텀 formatter로 위 필드 자동 주입
- 개발 환경: `format.prettyPrint()` 추가로 가독성 보강 (production은 단일 라인 JSON)
- 테스트 환경: 파일 로거 비활성화 (CLAUDE.md "테스트 환경: 파일 로거 비활성화" 정책 유지)

### 1.2 [확정] 로그 레벨 정책

**결정**: [확정]

| 레벨 | 사용 기준 |
|---|---|
| `debug` | 개발 디버깅 전용. production에서 비활성화. 비즈니스 흐름 상세, SQL 쿼리 trace |
| `info` | 정상 비즈니스 이벤트 (request.completed, post.created, notification.sent, outbox.published). 운영 가시성용 |
| `warn` | 복구된 예외 / 정책 위반(예: idempotency 중복 감지 §async §6.3) / 일시적 외부 의존 실패 후 재시도 성공 / DLQ 진입 |
| `error` | 사용자 응답 실패 / 핸들러 처리 중 미복구 예외 / 외부 의존 호출 최종 실패 / DB 트랜잭션 롤백. **운영자 대응 필요 항목** |
| `fatal` | 프로세스 종료 수준 장애 (DB connection pool 완전 고갈, Kafka 브로커 연결 영구 실패 등). NestJS lifecycle 종료 hook 트리거 |

**환경별 출력 레벨**:
- production: `info` 이상
- development: `debug` 이상
- test: `error` 이상 (테스트 노이즈 최소화)

**근거**: nest-winston 공식 + Google SRE "Logging at the right level" + Phase 2 도입 시점에 환경변수 `LOG_LEVEL` 추가하여 런타임 변경 가능

**기각 대안**: (1) `info` 단일 레벨 — 디버깅 시 잡음 과다. (2) `error`만 production 보존 — 비즈니스 이벤트 추적 불가, 부하 테스트 결과 해석 어려움

**파급 효과**: Winston `level: process.env.LOG_LEVEL || 'info'`로 동적 변경. ConfigService 통한 주입 (CLAUDE.md "환경변수 직접 접근 금지, ConfigService 사용" 정합)

### 1.3 [확정] 민감 정보 마스킹

**결정**: 다음 키는 로그 출력 시 자동 마스킹. Winston formatter 단계에서 객체 깊이 우선 탐색 후 redaction [확정]

**마스킹 키 블랙리스트**:
- `password`, `salt`
- `refreshToken`, `refresh_token`, `accessToken`, `access_token`
- `credentialToken` (Google OAuth ID Token 입력)
- `idToken`, `id_token`, `bearer`, `authorization`
- `cookie`, `set-cookie`
- `idempotency_key`, `idempotency-key` (PII는 아니나 대량 로그 노출 시 재현 공격 표면 증가)
- `provider_subject` (security.md §4 준식별자)

**마스킹 출력**: `"<REDACTED:length=<원본 길이>>"` — 원본 값 길이만 노출하여 디버깅 단서 보존, 값 자체 차단

**HTTP 요청/응답 본문 로깅 정책**:
- 기본 비활성화 — Interceptor에서 본문 자동 로깅 금지
- 명시적으로 필요 시(에러 디버깅 등) Service 레이어가 직접 logger.debug 호출 + 본인이 마스킹 책임

**근거**: security.md §4 PII 식별 표 (password / refresh_token / credentialToken / provider_subject 등) + OWASP Logging Cheat Sheet "Exclude" 절 + GDPR Art.32 (적용 대상은 아니나 가이드라인 참조)

**기각 대안**:
- (1) 마스킹 없이 환경변수 토글 — 실수로 production 노출 위험. **블랙리스트 + 코드 강제**가 안전
- (2) Whitelist 방식 (허용 키만 출력) — 신규 필드마다 화이트리스트 갱신 부담. 본 프로젝트 도메인은 PII 키 집합이 좁아 블랙리스트 충분
- (3) 마스킹을 Service 레이어 책임으로 — 누락 위험. Winston formatter에서 글로벌 강제

**파급 효과**:
- Phase 2 진입 시 `src/config/winston.config.ts`(또는 신설)에 `redactFormat()` 추가
- E2E 테스트로 마스킹 동작 검증 (password 포함 응답이 로그에 평문 없음 확인)
- security.md §4 데이터 보호 §refresh_token 해시 저장 결정과 정합 (Phase 5 검토 대상이지만 로그 마스킹은 Phase 2 선행)

### 1.4 [확정] Correlation ID 전파 구현

**결정**: NestJS Global Interceptor + Node.js `AsyncLocalStorage`로 요청 단위 Correlation ID 컨텍스트 관리 [확정]

application-arch.md §채택 패턴 [확정] "Interceptor + AsyncLocalStorage"의 구현 세부.

**구현 사양**:
- 헤더 이름: `X-Correlation-Id` (수신 우선)
- 수신 우선순위:
  1. 요청 헤더 `X-Correlation-Id`가 있고 다음 형식 중 하나에 해당하면 채택
     - UUID v4 (RFC 4122) 형식
     - `k6-vu{N}-iter{M}-<uuid>` 형식 (Phase 4 부하 테스트 트래픽 식별 — §7.2 정합)
  2. 없거나 형식 위반이면 서버 생성 (`crypto.randomUUID()`, UUID v4)
- AsyncLocalStorage key: `correlation_id`
- 응답 헤더 echo: `X-Correlation-Id: <id>` 항상 응답에 포함 (클라이언트 추적 지원). Correlation ID는 비즈니스 식별자로 PII 아님 — security.md §4 데이터 보호 정합
- Winston formatter: AsyncLocalStorage에서 `correlation_id`를 자동 추출하여 모든 로그 라인에 주입
- 비동기 경로 전파:
  - **Outbox INSERT 시점**: 이벤트 envelope의 `payload._meta.correlation_id`에 포함 (또는 envelope 최상위에 추가 — async-processing.md §4.2 envelope 구조 확장 필요 — Core 재동기화 요청 §하단 참조)
  - **Kafka publish**: Kafka message header `x-correlation-id`로 전달
  - **Kafka consume**: Header에서 추출하여 consumer의 AsyncLocalStorage에 set
  - **BullMQ enqueue**: job data에 `correlation_id` 필드 포함
  - **BullMQ worker**: job 실행 시 AsyncLocalStorage에 set

**Trace ID와의 관계**:
- Correlation ID는 비즈니스 식별자(요청 추적용)
- Trace ID는 OpenTelemetry W3C Trace Context (트레이싱 백엔드 식별자)
- 둘은 독립 — Correlation ID는 Trace ID보다 수명이 길 수 있음(예: 클라이언트가 동일 Correlation ID로 여러 요청 묶기). 본 프로젝트는 1:1로 운용하되 필드는 분리 보존

**근거**: TP6 + AntiPattern Blind Faith + Node.js 공식 AsyncLocalStorage (Node 16+) + NestJS 공식 Interceptor 컨벤션 + W3C Trace Context (Trace ID는 별도 표준)

**기각 대안**:
- (1) Correlation ID = Trace ID — 트레이싱 비활성화 시 Correlation ID도 사라짐. 분리가 안전
- (2) cls-hooked — 레거시, Node 16+ AsyncLocalStorage로 대체됨
- (3) 명시적 파라미터 전달 — Service 시그니처 침투 (Shotgun Surgery)

**파급 효과**:
- Phase 2 진입 시 `src/interceptor/correlation-id.interceptor.ts`(전역) + `src/utils/correlation-context.ts`(AsyncLocalStorage wrapper) 신설
- async-processing.md §4.2 envelope 구조에 `correlation_id` 필드 추가 필요 (Core 재동기화 요청)
- 모든 외부 의존(Google OAuth, Redis, Kafka producer)에 Correlation ID 헤더/태그 전파 가능 (학습 프로젝트는 우선 내부 흐름만)

### 1.5 [확정] 로그 출력 대상 — Phase 2/3 단계적 전환

**결정**: [확정]

| 단계 | 출력 대상 | 비고 |
|---|---|---|
| Phase 0~1 (현재 유지) | stdout + winston-daily-rotate-file (`logs/error/`, `logs/info/`) | 현 구조 유지. 30일 보관, zip 압축 |
| Phase 2 (관측성 도입) | stdout(JSON) → Promtail → Loki | 파일 로테이션은 보조로 유지. Loki가 primary 검색 경로. 12-Factor XI Logs as event streams 정합 |

**Promtail 구성**:
- Docker Compose에 Promtail 컨테이너 추가 (Phase 2)
- Application stdout을 직접 수집 (Docker driver가 아닌 stdout pipe)
- Loki에 push, label은 `{service, env, level}` 3개로 한정 (§2.3 카디널리티 정책)

**근거**: 12-Factor App XI + Grafana Loki 공식 권장 (label 카디널리티 < 10) + 학습 프로젝트에서 LGTM 통합 학습 가치

**기각 대안**:
- (1) ELK 스택 (Elasticsearch + Logstash + Kibana) — Java/JVM 자원 부담, 학습 프로젝트 로컬 환경 무거움
- (2) CloudWatch Logs — 클라우드 의존, out-of-scope
- (3) Datadog — SaaS 비용
- (4) 파일만 유지 — Phase 4 부하 테스트 시 로그 검색 불가 (튜닝 분석 어려움)

**파급 효과**:
- Phase 2 진입 시 docker-compose.yaml에 Loki + Promtail + Grafana 컨테이너 추가
- 기존 winston-daily-rotate-file은 보조(로컬 디스크 백업)로 유지 — Loki 장애 시 fallback
- security.md §7 포렌식 로그 보존 30일은 Loki retention policy로 강제 (§1.6)

### 1.6 [확정] 로그 보존

**결정**: 모든 로그 30일 보존 [확정]

**근거**: security.md §7 [확정] "포렌식 로그 보존 30일" + 학습 프로젝트 로컬 디스크 용량 (Loki Hot 30일이면 GB 단위 수용 가능) + async-processing.md §6.4 processed_events 보존 30일과 정합 (관측 가능 윈도우 일치)

**구체 정책**:
- Loki: `limits_config.retention_period: 720h` (30d). Compactor가 자동 삭제
- 파일 로테이션: 현행 30일 유지 (winston-daily-rotate-file `maxFiles: '30d'`)
- Cold archive 미적용 — 학습 프로젝트, 30일 이후 재현 가치 낮음

**기각 대안**:
- (1) 7일만 보존 — DLQ 재처리(30일) 윈도우 동안 분석 불가
- (2) 무기한 보존 — 디스크 폭증, 학습 가치 낮음

### 1.7 [확정] 로그 샘플링 — 미적용

**결정**: 샘플링 미적용 [확정]

**근거**: 학습 프로젝트 트래픽 규모(로컬 부하 테스트라도 수만 RPS 미만) + Phase 3 비동기화 측정에서 샘플링은 데이터 왜곡 위험 + Loki 30일 보존 용량 충분 (수십 GB 추정)

**조건부 재검토**: Phase 4 부하 테스트에서 Loki ingestion 한계(default 4MB/s burst) 초과 시 `info` 레벨만 10% 샘플링 [가이드]. `warn`/`error`는 항상 전량.

## 2. 메트릭 (Metrics)

### 2.1 [확정] 측정 프레임 — RED + USE 조합

**결정**: 서비스 수준 RED(Rate / Errors / Duration — Tom Wilkie 2015) + 인프라 수준 USE(Utilization / Saturation / Errors — Brendan Gregg 2013) 조합 [확정]

**RED — HTTP 엔드포인트 (서비스 수준)**:
- `http_requests_total{method, path, status}` Counter — 요청 수 (Rate)
- `http_request_errors_total{method, path, status_class}` Counter — 5xx/4xx 비율 (Errors). status_class = `2xx|4xx|5xx`
- `http_request_duration_seconds{method, path, status}` Histogram — 응답 시간 분포 (Duration). bucket = `0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10` (Prometheus 기본)

**RED — Async (Kafka consumer / BullMQ worker)**:
- `kafka_messages_consumed_total{topic, consumer_group, status}` Counter
- `kafka_consume_duration_seconds{topic, consumer_group}` Histogram
- `bullmq_jobs_processed_total{queue, status}` Counter — status = `completed|failed|stalled`
- `bullmq_job_duration_seconds{queue}` Histogram

**USE — 시스템 자원 (인프라 수준)**:
- Node.js `nodejs_*` 기본 메트릭 (event loop lag, heap, GC, handles) — `prom-client` 자동 export
- MySQL — `mysql_global_status_*` (mysqld_exporter, Phase 2 추가). 핵심: connections, queries, slow_queries, innodb_buffer_pool_*
- Redis — `redis_*` (redis_exporter 추가). 핵심: connected_clients, used_memory, ops_per_sec, blocked_clients
- Kafka — `kafka_*` (kafka_exporter 추가, Phase 3 진입 시). 핵심: broker disk, partition under-replicated, consumer lag

**근거**: TP6 + Wilkie "RED Method" (Boxever 2015) + Gregg "USE Method" (2013) + Google SRE Workbook Ch.4 "Choosing SLIs"

**기각 대안**:
- (1) Custom metric만 — 표준 부재로 학습 가치 손실. RED/USE는 업계 표준
- (2) Four Golden Signals(Latency/Traffic/Errors/Saturation) — Google SRE 4종이지만 RED와 큰 차이 없음. RED가 단순하고 wilkie 정의가 더 보편

### 2.2 [확정] 비즈니스 메트릭

**결정**: 학습 목표(비동기화 효과 측정·기능 사용 추이)와 직결되는 도메인 카운터 6종 [확정]

| 메트릭 | 타입 | 라벨 | 의미 |
|---|---|---|---|
| `posts_created_total` | Counter | (없음) | 글 작성 수 누적 |
| `posts_viewed_total` | Counter | (없음) | 글 조회 수 누적 — Phase 3 hits 비동기 집계 검증 (Counter 합 = DB hits 합 ± 보정) |
| `post_likes_total{action}` | Counter | action=`liked|unliked` | 좋아요/취소 |
| `comments_created_total{type}` | Counter | type=`comment|reply` | 댓글/답글 생성 |
| `notifications_sent_total{type, status}` | Counter | type=`comment|reply`, status=`success|failed` | BullMQ notification 큐 처리 결과 |
| `outbox_pending_count` | Gauge | (없음) | `outbox.published_at IS NULL` 실시간 건수 (스크레이프 시점 SELECT) — async-processing.md §3.5 Backpressure 임계값 비교 대상 |

**Phase 3 추가**:
- `outbox_publish_lag_seconds` Histogram — Outbox INSERT부터 Kafka publish까지 지연
- `kafka_consumer_lag{topic, partition, consumer_group}` Gauge — Kafka exporter 수집

**근거**: BP1 비동기화 효과 측정 + BP2 부하 테스트 결과 해석 + RED Method "비즈니스 시그널 분리" + 각 메트릭이 problem.md UC와 1:1 대응 (UC-5 → posts_viewed, UC-6 → post_likes 등)

**기각 대안**:
- (1) `user_id`를 라벨로 — 카디널리티 폭증 (§2.3). 사용자 행위 분석은 로그/트레이스에서
- (2) 비즈니스 메트릭 없이 RED만 — 비동기화 효과(예: `posts_viewed_total`이 동기 DB hits와 일치하는지)를 검증할 시그널 부재

### 2.3 [확정] 메트릭 라벨 카디널리티 정책

**결정**: 라벨 cardinality 상한 100 / metric. 다음 키는 라벨로 사용 금지 [확정]

**금지 라벨**: `user_id`, `post_id`, `comment_id`, `reply_id`, `event_id`, `correlation_id`, `idempotency_key`, `email`, `login_id`, `provider_subject`

**허용 라벨**: `method`, `path`(라우트 패턴 — `/posts/:postId` 형식, 실제 ID 치환 후), `status`, `topic`, `consumer_group`, `partition`(0~3), `queue`, `type`, `action`, `service`, `env`, `version`

**근거**: Prometheus 공식 "Cardinality" 권장 (라벨당 < 10, metric series 합 < 1M) + Loki 라벨 정책과 일관 + security.md §4 PII 노출 방지 (메트릭은 일반적으로 SRE 외부 공유 가능성 있음)

**기각 대안**: 라벨 자유화 — Prometheus TSDB 메모리/디스크 폭증, Grafana 쿼리 성능 저하

**파급 효과**: NestJS Interceptor에서 `path`를 `req.route.path`(파라미터 치환된 패턴)로 추출. `prom-client.histogram.observe()` 호출 시 path 정규화 강제

### 2.4 [확정] SLI / SLO / Error Budget

**결정**: 측정 SLI 목록과 측정 방법은 [확정]. 임계값(SLO 수치)은 Phase 4 baseline 후 결정 [가이드] [확정]

**SLI 인벤토리**:

| SLI | 측정 방법 | 측정 윈도우 | SLO (가이드) |
|---|---|---|---|
| HTTP 가용성 | `1 - sum(http_request_errors_total{status_class="5xx"}) / sum(http_requests_total)` | 30일 rolling | 99.5% (가이드) |
| HTTP latency p99 | `histogram_quantile(0.99, http_request_duration_seconds)` per route category | 30일 rolling | 카테고리별 가이드 (Phase 4 확정) |
| Kafka consumer freshness | `max(kafka_consumer_lag) by (consumer_group)` | 5분 윈도우 | < 1000건 (async-processing.md §3.5 정합) |
| Outbox publish freshness | `outbox_pending_count`의 1분 윈도우 max | 1분 | < 100건 (async-processing.md §3.5 정합) |
| Notification 전달 성공률 | `sum(notifications_sent_total{status="success"}) / sum(notifications_sent_total)` | 30일 rolling | 99.0% (가이드) |

**라우트 카테고리** (latency SLO용):
- `auth` (`/users/auth/*`)
- `read` (GET 엔드포인트)
- `write` (POST/PATCH/DELETE 엔드포인트)
- `oauth` (외부 의존 포함, 별도 SLO)

**Error Budget 정책 [가이드]**:
- 학습 프로젝트라 Error Budget 소진 시 "기능 추가 동결" 같은 강제 정책은 형식적으로만 적용
- 본 프로젝트의 실질 활용: Type B 회고 블로그에서 "30일 windows budget consumed = X%" 수치 제시

**근거**: Google SRE Workbook Ch.2-4 (SLI/SLO 정의·측정·Error Budget) + async-processing.md §3.5 Backpressure 임계값 + RED Method "Errors는 비율 SLI의 기반"

**기각 대안**:
- (1) p50/p95만 측정 — p99이 부하 테스트 효과 측정의 핵심 지표(긴 꼬리 latency)
- (2) SLO를 현 시점에 임의 수치로 확정 — context.md [알려진 불확실성 3] 위반 (베이스라인 없는 SLO는 임의)

**파급 효과**:
- Phase 2: SLI 메트릭 수집 + Grafana 대시보드 표시 (수치 임계 표시 없음, 기준선 없이 추세만)
- Phase 4 진입 시 baseline 측정 → 본 §2.4 SLO 가이드 수치를 [확정]으로 승격하는 별도 결정 추가

### 2.5 [확정] 메트릭 저장소 — Prometheus

**결정**: Prometheus + prom-client(Node.js) [확정]

**근거**:
- overview.md [가이드] "부하 테스트 시각화 스택" — Prometheus + Grafana 우선 선택 조건 충족 (관측성 스택 통합 시)
- k6 → Prometheus Remote Write 통합 가능 (Phase 4 부하 테스트 결과 동일 대시보드)
- Grafana LGTM 스택 표준 구성 요소
- prom-client는 Node.js 사실상 표준 라이브러리

**기각 대안**:
- (1) OpenTelemetry Metrics SDK + Collector → Prometheus — Phase 2 도입 시점 복잡도 과다. OpenTelemetry는 트레이싱 primary로 한정(§3)
- (2) InfluxDB + Telegraf — k6 native 지원이지만 Loki/Tempo와 통합 어려움. LGTM stack 일관성 우위
- (3) Datadog/New Relic — SaaS 비용

**파급 효과**:
- Phase 2: docker-compose에 Prometheus + Grafana + node_exporter + mysqld_exporter + redis_exporter 추가
- Phase 3: kafka_exporter 추가
- NestJS 앱에 `/metrics` 엔드포인트 추가 (Prometheus scrape 대상). 인증 미적용 — 로컬 환경 + `@Public()` 데코레이터로 개방. 클라우드 배포 트리거 시 인증 또는 네트워크 격리 필요(security.md §3 시크릿 분류와 동일 트리거)

### 2.6 [확정] /metrics 엔드포인트 보안

**결정**: `GET /metrics`는 `@Public()` 데코레이터로 인증 면제. 로컬 POC 환경에서만 운용 [확정]

**근거**: Prometheus scrape는 단방향 풀 모델 + 로컬 Docker 네트워크 내 통신 + security.md §1 [확정] "서비스 간 인증 — 로컬 Docker Compose 네트워크 격리로 대체"

**클라우드 배포 트리거 시점 변경 사항** (out-of-scope, 명시 기록):
- /metrics는 별도 listen port + private subnet 한정
- 또는 Authorization header (Prometheus `bearer_token` 설정)

**파급 효과**: Phase 2 진입 시 `src/health/health.controller.ts` 또는 신규 `metrics.controller.ts`에 endpoint 추가. `@Public()` 화이트리스트에 추가 필요(현 4개 → 5개)

## 3. 트레이싱 (Tracing)

### 3.1 [확정] 트레이싱 적용 — Phase 3 진입 시 도입

**결정**: 트레이싱은 **Phase 3 진입 시점에 도입** (Phase 2는 로그/메트릭/Correlation ID에 집중) [확정]

**근거**:
- Phase 0~2까지는 단일 NestJS 프로세스 내 흐름이 대부분 — Correlation ID + 로그/메트릭으로 충분
- Phase 3에서 다단 프로세스 등장 (NestJS API + Outbox Relay Worker + Kafka Consumer + BullMQ Worker) — 분산 흐름 추적 가치 발생
- application-arch.md §모듈 구조 (Phase 1 이후) `notification`이 blog/user 이벤트 구독 — Phase 3 여러 프로세스 간 흐름 추적 필수

**기각 대안**:
- (1) Phase 2 동시 도입 — Phase 2에 추가 인프라(Tempo) + SDK 도입 부담. 단일 프로세스 흐름은 Correlation ID로 충분
- (2) Phase 3에도 미적용 — 비동기 흐름 디버깅 시 시각화 부재. async-processing.md §대표 처리 흐름도가 메모리 모델로만 존재

### 3.2 [확정] 프레임워크 — OpenTelemetry SDK

**결정**: OpenTelemetry SDK for Node.js + auto-instrumentation [확정]

**구성**:
- `@opentelemetry/sdk-node` — SDK 코어
- `@opentelemetry/auto-instrumentations-node` — HTTP / Express / NestJS / TypeORM / Redis / Kafkajs / BullMQ 자동 instrumentation
- `@opentelemetry/exporter-trace-otlp-http` — OTLP HTTP exporter
- 백엔드: Grafana Tempo (LGTM 스택)
- W3C Trace Context (traceparent / tracestate 헤더) 표준 사용

**근거**: TP6 + OpenTelemetry CNCF graduated project + W3C Trace Context (REC 2020) + Grafana Tempo 공식 OTLP 지원 + auto-instrumentation으로 코드 침투 최소화

**기각 대안**:
- (1) Jaeger SDK 직접 — OpenTelemetry가 Jaeger 후속 표준
- (2) Datadog APM / New Relic — SaaS 비용
- (3) 자체 구현 — Reinvent the Wheel AntiPattern

### 3.3 [확정] 샘플링 정책

**결정**: 환경별 차등 [확정]

| 환경 | 샘플링 비율 | 비고 |
|---|---|---|
| development | 100% | 디버깅 우선 |
| test | 0% (비활성화) | 테스트 격리 |
| 부하 테스트 (Phase 4) | 10% Head-based + Error 100% Tail-based | Tempo 저장 부담 회피 + 에러 추적 보존 |
| production (out-of-scope) | TBD | 클라우드 배포 트리거 시 결정 |

**근거**: OpenTelemetry Sampling 공식 가이드 + Google Dapper paper (2010) "Sampling for Distributed Tracing"

**기각 대안**:
- (1) 100% 항상 — Tempo 디스크 폭증
- (2) 10% Head-based만 — 에러 trace 누락 위험. Error Tail-based 추가 필수

### 3.4 [확정] 트레이스 컨텍스트 전파

**결정**: [확정]

| 경로 | 전파 방식 |
|---|---|
| HTTP 요청 (수신/송신) | W3C Trace Context (`traceparent`, `tracestate` 헤더) — auto-instrumentation 처리 |
| Kafka 이벤트 | Message header에 `traceparent` 주입 (Producer) → Consumer가 추출 후 새 span 시작 (parent: 추출된 SpanContext) |
| BullMQ job | Job data에 `_trace.traceparent` 필드 포함. Worker가 추출 후 span 시작 |
| TypeORM 쿼리 | auto-instrumentation 자동 child span 생성 |
| 로그-트레이스 연결 | Winston formatter가 `trace_id`, `span_id`를 자동 주입 (§1.1 필드) |

**근거**: W3C Trace Context REC + OpenTelemetry Context Propagation 사양 + Grafana "Logs to traces" 통합 (trace_id 클릭 시 Tempo trace 표시)

**기각 대안**:
- (1) Jaeger uber-trace-id 헤더 — W3C 표준이 후속, 호환 라이브러리 풍부
- (2) Custom 헤더 — 표준 미준수, 외부 도구 연계 불가

**파급 효과**:
- async-processing.md §4.2 envelope에 `_trace` 메타 필드 추가 필요 (Core 재동기화 요청)
- Outbox Relay Worker가 outbox 레코드를 Kafka로 publish할 때, 원본 트랜잭션 시점의 `traceparent`를 envelope에서 복원하여 Kafka header에 set (트랜잭션 → 발행 사이 시간 갭에서도 trace 연속성 보장)

## 4. 알림/경보 (Alerting)

### 4.1 [확정] 알림 분류 — Page vs Ticket

**결정**: 학습 프로젝트는 **Ticket only** 운영. Page 분류는 형식적으로 정의하되 실제 호출은 미적용 [확정]

| 분류 | 정의 | 본 프로젝트 운용 |
|---|---|---|
| Page (즉시 대응) | SLO violation 임박 / 사용자 영향 즉시 / 자동 복구 불가 | Slack `#blog-page` 채널 + (학습 프로젝트라 PagerDuty 미적용) |
| Ticket (검토 필요) | SLO 영향 가능성 / 회복 가능 / 추세 관찰 | Slack `#blog-ticket` 채널 |

**근거**: Google SRE Book Ch.6 "Alerting" (Page는 즉시 사람이 행동해야 함) + 1인 학습 프로젝트 + 24/7 on-call 부재

**기각 대안**:
- (1) PagerDuty/Opsgenie — 1인 학습에 비용·복잡도 과다
- (2) 알림 미적용 — Phase 4 부하 테스트 시 임계 위반 감지 불가

### 4.2 [확정] 알림 룰

**결정**: 다음 룰을 Prometheus Alertmanager로 운용 [확정]

| 알림 | 조건 (PromQL 개념식) | 분류 | 채널 |
|---|---|---|---|
| HTTP 5xx burn rate (fast burn) | 1h 5xx 비율 > 14.4 × SLO 기준 | Page | `#blog-page` |
| HTTP 5xx burn rate (slow burn) | 6h 5xx 비율 > 6 × SLO 기준 | Ticket | `#blog-ticket` |
| HTTP p99 latency violation | route category별 p99이 SLO 가이드 초과 5분 지속 | Ticket | `#blog-ticket` |
| Outbox 적체 | `outbox_pending_count > 100` 5분 지속 | Page | `#blog-page` |
| Kafka consumer lag | `kafka_consumer_lag > 1000` 5분 지속 (consumer_group별) | Ticket | `#blog-ticket` |
| BullMQ 큐 적체 | `bullmq_queue_waiting_count > 1000` 5분 지속 | Ticket | `#blog-ticket` |
| DLQ 유입 | `rate(dlq_messages_total[1m]) > 10` | Page | `#blog-page` |
| Idempotency 중복률 급증 | `rate(idempotency_duplicate_total[1h]) > 0.05 × rate(http_requests_total[1h])` | Ticket | `#blog-ticket` |
| Notification failure rate | `rate(notifications_sent_total{status="failed"}[10m]) > 0.01 × rate(notifications_sent_total[10m])` | Ticket | `#blog-ticket` |
| Node.js event loop lag | `nodejs_eventloop_lag_seconds > 0.5` 1분 지속 | Page | `#blog-page` |

**침해 대응 알림 (security.md §7 primary)** — 본 파일은 채널만 실체:
- `로그인 실패 연속 ≥ 5회/15분` → security.md §7에서 발생 → Slack `#blog-security` 채널
- `429 Rate Limit 초과 IP` → 동일
- `권한 거부 403 급증` → 동일
- `refresh token DB 불일치` → 동일

**채널 분리 근거**:
- `#blog-page` — Page 즉시 대응 (학습 프로젝트라 1인이 모니터링)
- `#blog-ticket` — Ticket 일별 검토
- `#blog-security` — 침해 대응 분리 (security.md §7 시그널 전용)
- 이메일 채널 미적용 — Slack webhook 단일

**근거**: Google SRE Workbook Ch.5 "Alerting on SLOs" multi-window multi-burn-rate (1h × 14.4 / 6h × 6 조합) + async-processing.md §3.5 Backpressure 임계값 + checklist-async.md §실패 모드

**기각 대안**:
- (1) 정적 임계값(`5xx > N건/분`) — Google SRE 명시 안티패턴 (트래픽 변동 미반영)
- (2) 모든 메트릭에 알림 — Alert Fatigue. SRE 원칙 "All alerts must be actionable" 위반

### 4.3 [확정] Alert Fatigue 방지

**결정**: [확정]

- **Grouping**: 동일 알림 룰의 5분 내 발화는 단일 알림으로 집계 (Alertmanager `group_by`)
- **Inhibition**: 상위 시그널 발화 시 하위 시그널 억제. 예: `Outbox 적체` 발화 중에는 `Kafka consumer lag` 알림 억제 (원인-결과 관계)
- **Maintenance window**: docker-compose 재기동·테스트 실행 시 5분 silence (Alertmanager `silence` 수동 등록 또는 환경변수 `ALERT_SILENCE=true`)
- **Resolved 알림**: 자동 발송 (해소 가시성)

**근거**: Google SRE Workbook Ch.6 "Reducing alert fatigue" + Alertmanager 공식 Inhibition Rules

### 4.4 [확정] 알림 채널 — Slack Incoming Webhook

**결정**: Slack Incoming Webhook 단일 채널 [확정]

**근거**: 학습 프로젝트 1인 운용 + Slack 무료 tier로 충분 + Alertmanager 공식 Slack receiver

**기각 대안**:
- (1) PagerDuty/Opsgenie — 비용·복잡도
- (2) 이메일 — 응답 지연
- (3) Discord — Alertmanager native 미지원

**파급 효과**:
- 시크릿 카테고리 추가 (security.md §3 시크릿 표): `SLACK_WEBHOOK_PAGE_URL`, `SLACK_WEBHOOK_TICKET_URL`, `SLACK_WEBHOOK_SECURITY_URL`
- security.md Core 재동기화 요청 (시크릿 표 추가)

## 5. 감사 로그 (Audit Log)

### 5.1 [확정] 적용 결정 — 학습 프로젝트 최소 적용

**결정**: 본 프로젝트는 규제 도메인 비해당이지만 audit_log 테이블을 신설하여 핵심 보안 이벤트 8종을 기록 [확정]

**근거**:
- security.md §7 [확정] 포렌식 로그 보존 30일 (적용 전제 = 감사 가능 로그 존재)
- security.md §7 [가이드] 침해 대응 시그널 (로그인 실패, 403 급증, refresh token DB 불일치) — 시그널 발생 시 감사 가능한 영구 기록 필요. Loki 구조화 로그만으로는 불변성 보장 한계
- 학습 가치: 4W1H + 무결성 보장 패턴 경험
- problem.md §State Machines 기록 "향후 알림 상태 명세" — 감사 로그가 상태 전이 추적 기반

**기각 대안**:
- (1) audit_log 미적용, Loki 구조화 로그로 대체 — Loki는 변조 가능, 보존 정책 차이 없음. 감사 무결성 학습 가치 누락
- (2) 외부 SIEM (Splunk/Sumo) 전송 — 비용·복잡도 과다, 학습 프로젝트 out-of-scope

### 5.2 [확정] 감사 대상 이벤트 8종

**결정**: 다음 이벤트 발생 시 audit_log INSERT [확정]

| Action | 발생 시점 | Resource | 비고 |
|---|---|---|---|
| `auth.login.success` | 로그인 성공 | user | login_id 기반 |
| `auth.login.failure` | 로그인 실패 | user (try) | login_id 기반, security.md §7 카운터 발생 시점 |
| `auth.oauth.linked` | OAuth provider 신규 연결 | user_auth_provider | application-arch.md OAuthProviderLinked 이벤트 |
| `auth.token.rotated` | RefreshToken Rotation 성공 | user | UC-4 |
| `auth.token.invalid_refresh` | refresh token DB 불일치 감지 | user | security.md §7 탈취 의심 시그널 |
| `authz.access_denied` | 권한 거부 (403) | resource (post/comment/reply/user_info) | IDOR 방어 발화 시점 |
| `user.deleted` | 사용자 계정 삭제 | user | CASCADE 영향 큼 |
| `post.deleted` | 글 삭제 | post | 관리자 모더레이션 시 핵심 (ADMIN 차등 권한 도입 트리거 시 확장) |

**향후 트리거 시 추가**:
- `notification.preferences.changed` — 알림 설정 도입 시
- `admin.action.*` — ADMIN 차등 권한 도입 시 (out-of-scope 트리거)

**근거**:
- application-arch.md Aggregate Command→Event 매핑 중 **보안 영향이 큰 이벤트**만 선별
- security.md §7 침해 대응 시그널과 1:1 대응 (감지 + 영구 기록)
- OWASP Logging Cheat Sheet "Event Sources to Log" — 인증/인가/권한 변경/민감 데이터 변경

**기각 대안**:
- (1) 모든 도메인 이벤트 감사 — 볼륨 과다. 도메인 이벤트는 Kafka로 충분
- (2) 인증 이벤트만 — 권한 거부/사용자 삭제 누락은 침해 추적 어려움

### 5.3 [확정] 감사 로그 수집 정책 (필드 의미)

**결정**: audit_log 레코드는 4W1H + 부가 메타데이터로 다음 필드 의미를 갖는다 [확정]

스키마 DDL은 data-design.md §audit_log 참조 (§6.1 실체 기술 레이어 규칙 — observability.md는 정책 primary, data-design.md는 스키마 primary).

**필드 정책 (정책 레이어)**:

| 필드 | 정책 의미 | 수집 규칙 |
|---|---|---|
| 발생 시각 | 이벤트 발생 도메인 시각 | UTC, ms 정밀도. Application 시각 기준 (DB CURRENT_TIMESTAMP 허용) |
| action | §5.2 표의 8종 action 이름 | snake_case + `.` 계층 (예: `auth.login.success`). action 추가는 §5.2 표 갱신과 동기화 |
| actor 사용자 ID | 행위자 식별자 | 인증 컨텍스트의 userId. 미인증 시 NULL (login.failure 시 시도된 login_id는 `changes.attempted_login_id`로 별도 기록) |
| actor 역할 | snapshot 시점 역할 | USER / ADMIN / ANONYMOUS. RBAC 변경 이력 추적용으로 행위 시점 값을 그대로 보존(현재 값 참조 금지) |
| resource 유형 | 영향받는 리소스 종류 | 도메인 명사 (user, post, comment, reply, user_auth_provider). ENUM이 아닌 자유 문자열 — Phase 확장 시 ALTER 회피 |
| resource ID | 리소스 식별자 | JSON-safe 문자열 또는 정수. PK 암호화 적용 전 평문 ID (감사 목적이므로 응답 노출과 무관) |
| 결과 | 성공/실패 | SUCCESS / FAILURE 이진 |
| 사유 코드 | FAILURE 시 분류 | ErrorCode enum 명칭 (예: `AUTH_INVALID_PASSWORD`). SUCCESS 시 NULL |
| client IP | 요청 source IP | Express `req.ip`. 클라우드 배포 트리거 시 X-Forwarded-For 신뢰 정책 보강 (out-of-scope) |
| User-Agent | HTTP User-Agent 헤더 원문 | 길이 상한(스키마 레이어 결정) — data-design.md §audit_log |
| correlation ID | §1.4 Correlation ID | Loki/Tempo 운영 로그와 cross-reference 진입점 |
| changes | 수정 이벤트의 before/after | JSON. **PII 마스킹 §1.3 적용 후 저장** — password / refresh_token / credentialToken 등은 평문 금지 |

**조회 패턴 정책 (스키마 레이어 인덱스 가이드)**:
- 행위자별 시간 역순 조회: 침해 의심 사용자의 활동 추적
- action별 시간 역순 조회: 특정 종류의 이벤트 집계 (로그인 실패 빈도 등)
- 리소스별 시간 역순 조회: 특정 리소스에 대한 변경 이력

위 3가지 조회 패턴을 만족하는 인덱스 설계 책임은 data-design.md (스키마 레이어) 소관.

**근거**:
- OWASP Logging Cheat Sheet "Event Attributes" 4W1H 표준
- ISO/IEC 27001 A.12.4 Logging requirements (적용 대상은 아니나 가이드라인)
- correlation_id 필드로 Loki/Tempo와 cross-reference (operational debugging)

**기각 대안**:
- (1) `changes`를 별도 테이블로 분리 — JOIN 비용. 학습 프로젝트는 JSON 단일 컬럼이 단순
- (2) `resource_type` ENUM — 향후 확장 시 ALTER 부담. 자유 문자열이 유연
- (3) actor_role을 audit 시점이 아니라 현재 user 테이블 JOIN으로 조회 — 권한 변경 이력 손실. snapshot이 감사 본질

**파급 효과**:
- data-design.md §Phase 2 스키마 진화에 audit_log 테이블 DDL 신설 필요 (**Core 재동기화 요청**) — 본 §5.3 필드 정책을 컬럼 타입·길이·인덱스로 구체화하는 책임
- application-arch.md §Phase별 진화 로드맵 Phase 2 행에 "audit_log 테이블 신설" 추가 필요 (**Core 재동기화 요청**)
- AuditLogRepository는 INSERT-only 인터페이스 노출 (§5.4 무결성 보장과 정합) — 구현 작업

### 5.4 [확정] 무결성 보장 — append-only + 학습 프로젝트 단순화

**결정**: 무결성은 append-only 제약(application + DB-level)으로 강제. 해시 체인/WORM 미적용 [확정]

**구체 구현**:
- **application-level**: AuditLogRepository는 INSERT 메소드만 노출. UPDATE/DELETE 메소드 부재
- **DB-level**: TypeORM Entity에서 `@UpdateDateColumn` 미사용. 트리거로 UPDATE/DELETE 차단 검토 (Phase 2 진입 시 필요성 판단 — 학습 가치는 있으나 MySQL 트리거 운용 부담)
- **DB user 권한 분리** [가이드]: production 트리거 시점에 audit_log 전용 user에 INSERT/SELECT만 GRANT. 본 프로젝트 로컬 환경은 단일 user 사용. 시크릿(DB credential) 카테고리화 책임은 security.md §3 (audit_log 전용 user는 클라우드 배포 트리거 시점에 신규 시크릿으로 추가됨)

**미적용 항목 (학습 프로젝트 단순화)**:
- 해시 체인 (각 레코드의 hash가 직전 레코드 hash 포함) — 학습 가치 명확하나 Phase 2 범위 압박. 후속 학습 과제로 기록
- WORM 저장 (S3 Object Lock 등) — 클라우드 의존
- 외부 SIEM 전송 — 비용

**근거**:
- ISO/IEC 27001 A.12.4.2 "Protection of log information" 무결성 요구 (적용 대상 아니나 가이드라인)
- 본 프로젝트는 규제 도메인 비해당이므로 append-only application contract만으로 학습 충분
- problem.md Out-of-scope "ADMIN vs USER 차등 권한" — audit_log 권한 분리 트리거(관리자 기능 도입)와 동기화

**기각 대안**:
- (1) UPDATE/DELETE 허용 — 감사 무결성 본질 위반
- (2) 해시 체인 즉시 적용 — Phase 2 범위 초과 + 학습 프로젝트 무결성 검증 시나리오 부재

### 5.5 [확정] 보존 기간

**결정**: 30일 [확정]

**근거**: security.md §7 [확정] 포렌식 로그 보존 30일과 정합 + Loki 30일 보존(§1.6) + processed_events 30일(async §6.4) — 관측 윈도우 일관

**구체 정책**:
- 주 1회 배치 `DELETE FROM audit_log WHERE occurred_at < NOW() - INTERVAL 30 DAY`
- async-processing.md §6.4 processed_events 삭제 배치와 동일 schedule 통합

**기각 대안**:
- (1) 1년 — 학습 프로젝트 디스크 부담 + 재현 가치 낮음
- (2) 무기한 — 디스크 폭증

**파급 효과**: 프로덕션 트리거(개인정보보호법 적용 등) 시 보존 기간 재산정 (개인정보보호법 접근 기록은 1~3년 요구)

### 5.6 [확정] 접근 제어

**결정**: [확정]

**현 단계 (학습 프로젝트)**:
- audit_log 조회 API 엔드포인트 미제공 — 운영자가 DB 직접 접근하여 SELECT
- DB 접근 자체가 단일 개발자 한정 (context.md [이해관계자])

**ADMIN 차등 권한 도입 트리거 시점** (out-of-scope, 명시 기록):
- `GET /admin/audit-logs` 엔드포인트 신설 — `@Roles(ADMIN)` 적용
- 조회 행위 자체도 audit_log INSERT (`action: admin.audit.viewed`)

**근거**: 학습 프로젝트 단순화 + ADMIN 차등 권한 정의가 Out-of-scope (problem.md §해결 범위)

### 5.7 [확정] 암호화

**결정**: 저장 시 추가 암호화 미적용 [확정]

**근거**:
- audit_log 필드는 `correlation_id`, `client_ip`, `user_agent`, `changes`(PII 마스킹 후) 정도로 직접 식별자 최소
- §1.3 PII 마스킹이 application-level에서 선행 (changes 필드는 마스킹 후 JSON 저장)
- DB 자체 암호화는 클라우드 배포 트리거 시 RDS encryption at rest로 처리 (out-of-scope)

**기각 대안**: 컬럼 단위 application-level 암호화 — 검색·인덱싱 비용. 학습 프로젝트 단순화 우선

## 6. 에러 처리와 로깅 표준

본 프로젝트는 error-handling-standards 스킬을 기본 적용한다. 본 Extension에서는 프로젝트 특화 규칙만 명시한다.

### 6.1 [확정] 에러 계층 구조

**결정**: 현 BaseException 계층 유지 [확정]

```
BaseException (abstract, ErrorCode enum 기반)
├─ auth/* (10xxx)
├─ user/* (20xxx)
├─ blog/* (30xxx, 31xxx)
├─ validation/* (91xxx)
└─ UnexpectedCodeException (fallback)

HttpException (NestJS 표준)
└─ HttpExceptionFilter 처리

Unhandled (catch-all)
└─ UnhandledExceptionFilter → 500 + COMMON_INTERNAL_ERROR
```

**근거**: CLAUDE.md "타입별 Exception Filter 계층" + 기존 ErrorCode 5자리 체계 유지 + Phase 1에서 Comment/Reply/Notification 도메인 추가 시 동일 패턴(BaseException 하위 디렉토리 신설) 적용

**기각 대안**:
- (1) 단일 BaseException + reason 필드 — 도메인별 분리 학습 가치 손실
- (2) RFC 9457 Problem Details 응답 포맷 도입 — §6.2 결정과 충돌 (HTTP 200 컨벤션 유지)

### 6.2 [확정] 외부 에러 응답 포맷 — Phase 5에 RFC 9457 Problem Details 전환

**결정**: Phase 1~4까지는 기존 "HTTP 200 + SuccessResponse/FailureResponse + ErrorCode" 컨벤션 유지. **Phase 5 진입 시 RFC 9457 Problem Details + 표준 HTTP status code(4xx/5xx) 사용으로 전환** [확정]

**Phase 5 전환 후 응답 형식 (Problem Details)**:

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/problem+json

{
  "type": "https://blog.example/errors/auth-invalid-password",
  "title": "Invalid password",
  "status": 401,
  "detail": "비밀번호가 올바르지 않습니다",
  "instance": "/users/auth/login",
  "errorCode": "AUTH_INVALID_PASSWORD",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**필수 필드 (RFC 9457 §3)**: `type` (URI, 에러 분류), `title` (영문 단문), `status` (HTTP status code), `detail` (사람-읽기 메시지, 한국어 허용), `instance` (요청 path)

**프로젝트 확장 필드**: `errorCode` (기존 5자리 enum 유지 — 클라이언트 매뉴얼 매핑 호환), `correlationId` (§1.4 cross-link)

**ErrorCode → HTTP status 매핑 표** (Phase 5 전환 시 확정):

| ErrorCode 도메인 | HTTP status | 비고 |
|---|---|---|
| Auth (10xxx) | 401 / 403 | UNAUTHORIZED → 401, INVALID_PASSWORD → 401, REFRESH_TOKEN_REQUIRED → 401 |
| User (20xxx) NOT_FOUND | 404 | |
| User (20xxx) ALREADY_EXISTS | 409 | |
| Post (30xxx) NOT_FOUND | 404 | |
| PostLike (31xxx) ALREADY_EXISTS | 409 | |
| PostLike (31xxx) NOT_FOUND | 404 | |
| Validation (91xxx) | 400 | |
| COMMON_TOO_MANY_REQUESTS | 429 | security.md §5 정합 |
| COMMON_INTERNAL_ERROR | 500 | |
| COMMON_SERVICE_UNAVAILABLE | 503 | |

**근거**:
- TP8 (BP6 프로덕션 품질 개선) Phase 5 확정 범위 + Problem TP8 "Smell Oddball Solution / AntiPattern Reinvent the Wheel" 해소 흐름 정합 — "HTTP 200 + body 내 ErrorCode" 컨벤션이 Reinvent the Wheel에 해당
- RFC 9457 (Problem Details for HTTP APIs, IETF 2023) 표준
- Spring Boot 3+ / ASP.NET Core 7+ native opt-in 도입 (사실상 표준 추세) — Node.js/NestJS 진영도 동일 표준 학습 가치
- Phase 5 NestJS 11 + @nestjs/swagger 11 메이저 업그레이드와 동시 작업으로 응답 인프라 일괄 변경 (호환성 깨짐 시점 일원화)
- application-arch.md §Phase별 진화 Phase 5 (현재) "NestJS 11 업그레이드에 따른 전역 영향" 범위 확장 — Core 재동기화 요청

**기각 대안**:
- (1) 현 컨벤션 영구 유지 — 표준 부재의 Reinvent the Wheel 지속, 학습 가치 누락. BP6 학습 목표 미달성
- (2) Phase 1 신규 엔드포인트(Comment/Reply)부터 점진 전환 — 기존/신규 이중 응답 표준 운영, 클라이언트 파싱 분기 부담. 비추천
- (3) NestJS 11 업그레이드와 분리하여 Phase 6 신설 — 동일 응답 인프라를 두 번 손대는 비효율
- (4) RFC 9457 native NestJS 라이브러리(`@sjfrhafe/nest-problem-details`) 사용 vs 직접 구현 — Phase 5 진입 시점에 라이브러리 안정성·유지보수 상태 평가 후 결정 [가이드]

**Phase 1~4 운영 (전환 전)**:
- 기존 SuccessResponse/FailureResponse + HTTP 200 컨벤션 유지
- **예외 — Rate Limit 429**: security.md §5 [확정] "HTTP 429 + Retry-After" — Phase 1 도입. @nestjs/throttler가 RFC 6585 표준 준수, FailureResponse body는 `code: COMMON_TOO_MANY_REQUESTS` 신설하여 함께 반환. Phase 5 전환 시 자연스럽게 RFC 9457 통합

**파급 효과**:
- Phase 5 진입 시 모든 ExceptionFilter 재작성 (BaseExceptionFilter / HttpExceptionFilter / UnhandledExceptionFilter) — application/problem+json Content-Type, status code 동적 매핑, ErrorCode → status code 변환 로직
- Phase 5 진입 시 BaseException에 `httpStatus` 추상 getter 추가 — 도메인별 구체 예외 클래스가 override
- 모든 E2E 테스트 응답 검증 로직 재작성 (HTTP 200 단일 가정 → status code별 분기)
- Swagger 문서: `@ApiResponse({ status: 401, type: ProblemDetailsDto })` 형식으로 전수 갱신 — application-arch.md Phase 5 행 "Swagger 문서 품질 개선" 범위에 RFC 9457 응답 스키마 추가
- problem.md TP8 — Phase 5 "프로덕션 수준 품질 갭" 항목에 "RFC 9457 Problem Details 전환" 추가 (Core 재동기화 요청)
- security.md §5 Rate Limit 429 — Phase 5 전환 후 Problem Details 포맷 자연 통합 (별도 결정 불필요)

### 6.3 [확정] 사용자 노출 메시지 — 민감 정보 누출 방지

**결정**: [확정]

- **금지**: 스택 트레이스, SQL 쿼리 원문, 내부 경로, 환경변수 값, DB 스키마 정보
- **허용**: ErrorCode + 일반화된 메시지 (예: `"비밀번호가 올바르지 않습니다"`)
- **개발 환경 예외**: `NODE_ENV=development`에서만 `cause` 필드에 내부 메시지 포함. production은 `cause` 항상 미포함

**구현 위치**: `src/filter/*ExceptionFilter` 클래스에서 환경 분기 + `cause` 필드 control

**근거**: OWASP A04 Insecure Design / A05 Security Misconfiguration + security.md §4 데이터 보호 정합 + UnhandledExceptionFilter는 원본 에러 로깅(§1.2 error 레벨)만 + 사용자에게는 generic 메시지

**기각 대안**: 모든 환경에서 동일 응답 — 개발자 디버깅 비용 증가

### 6.4 [확정] 재시도 가능 vs 불가능 에러 구분

**결정**: ErrorCode가 retriable 여부를 명시적으로 분류 [확정]

| ErrorCode 카테고리 | Retriable | 비고 |
|---|---|---|
| Auth (10xxx) | No | 인증 실패는 클라이언트 입력 오류 |
| User (20xxx) | No | 도메인 규칙 위반 |
| Post/PostLike (30xxx, 31xxx) | No | 도메인 규칙 위반 |
| Validation (91xxx) | No | 입력 형식 오류 |
| `COMMON_SERVICE_UNAVAILABLE` (90xxx) | **Yes** | 외부 의존 일시 장애 |
| `COMMON_INTERNAL_ERROR` (90xxx) | **Yes (제한적)** | 일시적 unhandled, 재시도로 복구 가능성 |
| `COMMON_TOO_MANY_REQUESTS` (90xxx, 신설 검토) | **Yes (Retry-After 후)** | Rate Limit |

**구현**:
- BaseException에 `isRetriable: boolean` getter 추가 (도메인별 override)
- 응답 헤더 `Retry-After` (Rate Limit + ServiceUnavailable 시)
- 클라이언트는 ErrorCode + isRetriable 조합으로 재시도 판단

**근거**: checklist-common §외부 서비스 회복력 + RFC 9110 §15.5/15.6 (4xx vs 5xx semantic) + Helland Idempotence (재시도는 idempotency-key와 결합 — security.md §8 정합)

**기각 대안**:
- (1) HTTP status code로만 구분 — 본 프로젝트는 항상 200이므로 불가
- (2) 클라이언트가 ErrorCode 매뉴얼 매핑 — 서버 contract로 명시가 안전

## 7. k6 부하 테스트 통합

### 7.1 [확정] k6 결과 → Prometheus Remote Write

**결정**: k6 → Prometheus → Grafana 동일 대시보드 [확정]

**근거**: overview.md [가이드] "부하 테스트 시각화 스택 — Prometheus + Grafana 우선" 충족 조건 + k6 v0.42+ 공식 Remote Write Output + Phase 4/5 비교의 일관성 (단일 시각화 플랫폼)

**구체 구성**:
- k6 실행: `k6 run --out experimental-prometheus-rw=http://prometheus:9090/api/v1/write script.js`
- k6 메트릭 (built-in): `http_reqs`, `http_req_duration`, `vus`, `iterations`, `data_sent`, `data_received` 등 자동 export
- Custom 메트릭: User Journey 단계별(`login_success_rate`, `journey_complete_duration`) — script에서 정의

### 7.2 [확정] 부하 테스트 시 Correlation ID 전파

**결정**: k6 script가 각 요청에 `X-Correlation-Id: k6-vu{VU번호}-iter{반복번호}-{uuid}` 형식으로 송신 [확정]

**근거**: §1.4 Correlation ID 전파 정합 (수신 우선순위 정책에 k6 형식 명시 포함) + Phase 4 부하 테스트 시 특정 요청을 Loki/Tempo에서 추적 가능 + k6 로그 ↔ 서버 로그 연결 + VU번호/반복번호로 부하 패턴 분석 가능

**기각 대안**:
- (1) k6도 순수 UUID v4 사용 — 부하 테스트 트래픽과 일반 트래픽 구분 어려움 (Loki 라벨로 분리 불가)
- (2) k6 전용 별도 헤더 (`X-K6-Test-Id`) — Correlation ID 전파 일관성 깨짐, Loki/Tempo cross-link 이중화

**파급 효과**: §1.4 수신 우선순위 정책에 k6 형식 허용을 함께 명시 (본 결정과 §1.4가 동시 [확정])

### 7.3 [가이드] 관측 오버헤드 측정

**결정**: Phase 4 baseline 측정 시 관측성 활성/비활성 두 차례 실행하여 오버헤드 정량화 [가이드]

**근거**: TP6 제약 "관측 오버헤드가 튜닝 대상 성능에 영향을 줄 수 있음" + Type B 회고 블로그 소재

**구체 절차**:
- 1회차: 관측성 비활성 (LOG_LEVEL=error, /metrics scrape 중단, OTEL_SDK_DISABLED=true)
- 2회차: 관측성 활성 (정상 운영 설정)
- 비교 지표: p50/p95/p99 latency, RPS 상한, CPU/메모리 사용률

## 8. Graceful Shutdown (관측성 관점)

async-processing.md §8.5 Graceful Shutdown 보강. 관측성 관점:

### 8.1 [확정] Shutdown 시 메트릭/로그 flush

**결정**: SIGTERM 수신 시 다음 순서 [확정]

1. NestJS `app.enableShutdownHooks()` lifecycle 트리거
2. HTTP server `close()` — 신규 요청 거부
3. async-processing.md §8.5 절차 (Kafka consumer pause / BullMQ worker pause / in-flight ACK 대기, 30s timeout)
4. Prometheus `/metrics` scrape 마지막 1회 강제 트리거 (`pushgateway` 활용 또는 단순 sleep 5s 대기)
5. OpenTelemetry SDK `shutdown()` — pending span flush
6. Winston transport `flush()` — 파일 / Loki transport 미전송 로그 flush
7. Process exit

**근거**: 12-Factor IX (Disposability) + OpenTelemetry SDK Shutdown sequence + Winston graceful shutdown 가이드

**기각 대안**: 즉시 종료 — span/log 손실, 부하 테스트 결과 불완전

## Sources

- docs/context.md (성공 지표 3 관측성 가시화 / 알려진 불확실성 3 SLO 미정)
- docs/problem.md (BP4, TP6, UC-1~7, Phase 2 근거)
- docs/solution/overview.md (배포 모델, 부하 테스트 시각화 [가이드])
- docs/solution/application-arch.md (채택 패턴 §Interceptor + AsyncLocalStorage [확정], Phase별 진화 로드맵)
- docs/solution/data-design.md (Phase별 스키마 진화, 트랜잭션/동시성)
- docs/solution/async-processing.md (§3.5 Backpressure, §4.2 envelope, §6 Idempotency, §7 DLQ, §8 실패 모드, §8.5 Graceful Shutdown)
- docs/solution/security.md (§3 시크릿, §4 PII, §7 침해 대응 알림 시그널, §8 API Idempotency)
- docs/meeting-logs/2026-04-24.md
- ~/.claude/skills/mcpsi-solution/references/solution-writing-principles.md
- ~/.claude/skills/mcpsi-solution/references/checklist-common.md (운영 섹션, 외부 서비스 회복력)
- ~/.claude/skills/error-handling-standards/SKILL.md (에러 처리 표준)
- 방법론 근거:
  - Tom Wilkie "RED Method" (Boxever 2015, Weaveworks blog)
  - Brendan Gregg "USE Method" (2013)
  - Google "Site Reliability Engineering" (2016) Ch.6 Alerting
  - Google "The Site Reliability Workbook" (2018) Ch.2 SLO / Ch.4 SLI / Ch.5 Alerting on SLOs
  - Google Dapper paper (Sigelman et al. 2010) — 분산 트레이싱 + 샘플링
  - 12-Factor App XI (Logs as event streams), IX (Disposability)
  - W3C Trace Context REC (2020)
  - OpenTelemetry Specification — Logs Data Model, Sampling, Context Propagation
  - OWASP Logging Cheat Sheet (Event Attributes, Retention, Exclude)
  - OWASP A04/A05 (Insecure Design / Misconfiguration)
  - ISO/IEC 27001 A.12.4 Logging requirements (가이드라인)
  - RFC 9110 (HTTP Semantics — 4xx/5xx semantic, Retry-After)
  - RFC 9457 (Problem Details for HTTP APIs, IETF 2023) — Phase 5 도입 결정 근거
  - Spring Boot 3 / ASP.NET Core 7+ Problem Details native 지원 (사실상 표준 추세 근거)
  - Tom Limoncelli et al. "The Practice of Cloud System Administration" — On-call 모델
  - Grafana LGTM Stack 공식 문서 (Loki / Tempo / Mimir / Grafana)
  - Prometheus Best Practices "Cardinality"
  - k6 Remote Write Output 공식 문서
  - Helland "Idempotence is Not a Medical Condition" (ACM Queue 2012, retriable 분류 근거)
