# ADR Index

명시 ADR 인덱스. 번호 → 제목 + Status + supersede 체인. mcpsi-traceability 단일 primary가 갱신 (description 확장: docs/meta/* 단일 운영자 + ADR 라이프사이클).

형식 사양: ~/.claude/skills/mcpsi-traceability/references/meta-folder-structure.md §2.1 - §2.2

마지막 갱신: 2026-05-12 (Solution-verify 통과 후 일괄 부여 + primary 표기 정정 + ADR-0001~0015 정식 MADR 4.0 본문 일괄 작성)

| 번호 | 제목 | Status | Source | Supersedes | Superseded by |
|------|------|--------|--------|------------|----------------|
| ADR-0001 | 모듈러 모놀리스 단일 BC "Blog Service" | Accepted | common/overview.md §Context Map | - | - |
| ADR-0002 | JWT access + refresh 이중 검증 (서버측 DB 대조 + Token Rotation) | Accepted | common/security.md §1 토큰 수명·회전 + docs/tech-notes/token-validation-strategies/ | - | - |
| ADR-0003 | Identity Separation + Account Linking (Phase 1) | Accepted | common/application-arch.md §채택 패턴 §Identity Separation + common/data-design.md §user_auth_provider | - | - |
| ADR-0004 | Event-Driven Architecture + Publisher-Subscriber (Phase 3) | Accepted | common/application-arch.md §채택 패턴 §EDA + common/async.md §1·§4 | - | - |
| ADR-0005 | Transactional Outbox (Phase 3) | Accepted | common/async.md §3.4 + common/data-design.md §outbox | - | - |
| ADR-0006 | BullMQ + Kafka 동시 채택 (작업 큐 + 이벤트 스트리밍 분리, Phase 3) | Accepted | common/async.md §3.1 | - | - |
| ADR-0007 | Idempotency Key Pattern (API 수신 측, Phase 1 도입) | Accepted | common/application-arch.md §채택 패턴 §Idempotency + common/security.md §8 | - | - |
| ADR-0008 | Interceptor + AsyncLocalStorage Correlation ID 전파 (Phase 2) | Accepted | common/application-arch.md §채택 패턴 §Interceptor + common/observability.md §1.4 | - | - |
| ADR-0009 | Grafana LGTM 스택 — Loki + Promtail + Grafana + Tempo + Prometheus (Phase 2) | Accepted | common/observability.md §1.5·§2.5·§3.2 | - | - |
| ADR-0010 | Adjacency List for Reply (깊이 1 제한, Phase 1) | Accepted | common/application-arch.md §채택 패턴 §Adjacency List + common/data-design.md §reply | - | - |
| ADR-0011 | k6 부하 테스트 + Prometheus Remote Write 시각화 통합 (Phase 4) | Accepted | common/overview.md §부하 테스트 도구·시각화 스택 + common/observability.md §7 | - | - |
| ADR-0012 | argon2id 비밀번호 해싱 전환 (Phase 5, Lazy Migration) | Accepted | common/security.md §1 종단 사용자 인증 방식 + common/application-arch.md §Expand-Contract | - | - |
| ADR-0013 | AES-GCM PK 암호화 전환 (Phase 5, AES-ECB supersede) | Accepted | common/security.md §4 PK 암호화 | - | - |
| ADR-0014 | RFC 9457 Problem Details 응답 표준 전환 (Phase 5, HTTP 200+FailureResponse supersede) | Accepted | common/observability.md §6.2 | - | - |
| ADR-0015 | User Aggregate Refactoring Towards Patterns — 7단계 점진 마이그레이션 (Phase 1) | Accepted | common/application-arch.md §3방향 리팩토링 + phase-1/data-migration.md | - | - |

대기 항목 (정식 ADR 파일 작성 보류, _index만 등록):
- Cursor-based Pagination [가이드] (common/application-arch.md §채택 패턴 §Cursor) — [가이드] 분류로 ADR 정식 부여 보류 (mcpsi-traceability 변경 임팩트 매트릭스 진입 시 [확정] 승격 검토 가능)
- Load Testing Methodology — Baseline + Load + Stress 3종 + User Journey (common/application-arch.md §Load Testing Strategy) — Phase 4 진입 시점 ADR 정식 부여 (현 시점 구체화 연기 항목 다수)

Status 값: Proposed / Accepted / Superseded / Deprecated. ADR-NNNN 단조 증가, supersede되어도 번호 재사용 금지.

정식 ADR 파일(MADR 4.0 포맷 — Title / Status / Context and Problem Statement / Considered Options / Decision Outcome / Consequences / Links) 작성 완료 (ADR-0001.md ~ ADR-0015.md, 2026-05-12). 본 _index는 빠른 조회와 supersede 체인 추적을 위한 인덱스. 후속 ADR 발행 시 본 _index 행 추가 + 정식 ADR-NNNN.md 본문 작성을 한 트랜잭션으로 수행 (mcpsi-traceability description 정합).

supersede 예정 관계 (Phase 5 시점 발화):
- ADR-0014(RFC 9457) supersede 후보: 현재 HTTP 200 + FailureResponse 컨벤션
- ADR-0012(argon2id) supersede 후보: SHA256 3회 반복 (현 baseline)
- ADR-0013(AES-GCM) supersede 후보: AES-ECB 16자 키 (현 baseline)

위 baseline 결정들은 별도 ADR 등록하지 않고 ADR-0012~0014의 Supersedes 컬럼에 baseline 식별자로 기록 예정 (실제 supersede 발생 시점 = Phase 5 전환 진입 시점, mcpsi-traceability 변경 임팩트 매트릭스 단계간 셀에서 자연 트리거).
