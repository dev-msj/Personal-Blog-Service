# Phase 1 Observability Deployment

본 Phase에서 적용하는 관측성 결정. **본격적인 observability/ 모듈 신설(Correlation ID Interceptor, 감사 로그, Prometheus 메트릭, OpenTelemetry SDK)은 Phase 2에 위임**한다. Phase 1은 기존 Winston 로깅 인프라 위에서 다음 보강만 수행한다.

정책 primary는 ../common/observability.md.

## Phase 1 적용 항목

### ErrorCode 추가

- `COMMON_TOO_MANY_REQUESTS` (90xxx 영역) — Rate Limit 429 응답 (security-deployment.md 참조)
- Phase 1 신규 도메인 (Comment/Reply) ErrorCode — 32xxx 영역 신설 (Comment 32xxx / Reply 33xxx 또는 통합)
  - 예: `COMMENT_NOT_FOUND`, `REPLY_NOT_FOUND` 등 (../common/observability.md §6.1 에러 계층 구조 정합)

### 로그 기록 보강 (Phase 2 모듈 신설 전)

기존 Winston 구조 유지 (nest-winston + winston-daily-rotate-file). Phase 1에서는 신규 로그 이벤트만 추가:

- `event: auth.login.failure` — 로그인 실패 시 (loginId, IP, 실패 횟수)
- `event: auth.login.failure_locked` — 5회 누적 잠금 발화 시점
- `event: authz.access_denied` — IDOR 방어 발화 시 (resourceType, resourceId, attemptedUserId, ownerUserId)
- `event: rate_limit.exceeded` — Throttler 발화 시 (path, tracker 값 — IP 또는 user_id)
- `event: idempotency.duplicate` — Idempotency-Key 중복 감지 시 (user_id, key)

위 이벤트는 Phase 2 진입 시 `audit_log` INSERT로 전환되거나 (../common/observability.md §5.2 감사 대상 이벤트 매핑), Loki 구조화 로그로 그대로 수집된다.

### 마스킹 키 점검 (Phase 2 본격화 전)

Phase 1에서 신규 도입되는 필드 중 마스킹 대상 사전 식별 (../common/observability.md §1.3 마스킹 키 블랙리스트 정합):
- `idempotency_key` / `idempotency-key` — 헤더 자체. Phase 1 진입 시 Winston format에 redact 함수 추가 권장 (Phase 2 본격화 전 임시 처리)
- `password`, `salt`, `refreshToken` 등 기존 마스킹 대상은 기존 처리 유지

Phase 2 진입 시 Winston formatter 전역 redact 적용. Phase 1은 Service 레이어가 직접 마스킹 책임 또는 위 임시 처리.

## Phase 1 범위 외 (Phase 2 위임)

- observability/ 모듈 신설 (Correlation ID Interceptor + AuditLogger + Metrics exporter + OpenTelemetry SDK)
- `X-Correlation-Id` 헤더 처리 및 AsyncLocalStorage 전파
- audit_log 테이블 신설 + AuditLogService INSERT-only contract
- prom-client `/metrics` 엔드포인트 신설
- LGTM 스택 docker-compose 추가 (Loki + Promtail + Grafana + Tempo + Prometheus)
- Slack Webhook 3종 시크릿 (PAGE / TICKET / SECURITY)
- 알림 룰 Alertmanager 설정
- RED + USE 메트릭 수집
- Winston JSON 구조화 포맷 + 12-Factor XI Logs as event streams 전환

위 항목은 Phase 2 진입 시 phase-2/observability-deployment.md에서 도입.

## Phase 2 연계 준비 (가벼운 표식만)

- Phase 1 신설 도메인(Comment/Reply) Service 레이어의 로그 호출 위치는 Phase 2 Correlation ID 자동 주입 시점에 추가 작업 없이 적용될 수 있게 표준 패턴(`this.logger.log({ event, ...context })`) 사용
- Idempotency 중복 감지, 로그인 실패 잠금 등 침해 대응 시그널(../common/security.md §7 + ../common/observability.md §4.2 알림 룰)은 Phase 2 Alertmanager 룰 매핑 대상으로 미리 식별

## Sources

- ../common/observability.md §1 로그 / §4 알림/경보 / §5 감사 로그 / §6 에러 처리
- ../common/security.md §7 침해 대응 알림
- security-deployment.md (Rate Limit / 로그인 실패 카운트 / IDOR 방어)
- async-deployment.md (Idempotency-Key 중복 감지 로그)
