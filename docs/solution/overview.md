# Overview

## 서비스 개요

Personal Blog Service는 백엔드 개발 역량 성장을 목적으로 하는 개인 학습/연구 프로젝트이자 NestJS 10 기반 블로그 API 서버다. "동작하는 API"가 아니라 "기술적 결정의 근거와 측정 가능한 검증 사이클"을 산출물로 삼으며, MCPSI 파이프라인을 통한 근거 문서화가 프로젝트 운영 원칙이다.

장기 목표: 비동기 시스템(cache / queue / Kafka) 적용 + 부하 테스트 기반 성능 튜닝 경험.

## 설계 원칙

- 결정 의무 형식: [확정] 4요소(결정/근거/기각 대안/파급 효과) + [가이드] 2요소(결정/근거) — solution-writing-principles.md 준수
- 근거 실명 참조: 모든 [확정]/[가이드]의 근거 라인에 Problem 코드(BP/TP/UC) / Context 제약 ID / 명명된 방법론 중 하나 이상 포함
- Aggregate 경계: Vernon 4 Rules (IDDD, 2013)
- Phase별 진화: problem.md Phase 0~5 근거를 단계적으로 따름. 각 Phase 진입 시점에 해당 Phase 범위의 Problem 재작성으로 상세화(알려진 불확실성 해소 원칙)
- 알려진 불확실성 의존 결정은 [확정] 금지 — [가이드] 분류 또는 해소 시점으로 연기

## Context Map

**단일 BC**: Blog Service

Context Map 관계 패턴 해당 없음. 외부 통합은 Google OAuth 2.0 ID Token 검증 1건이며, 이는 BC 간 관계가 아닌 **외부 서비스를 Anticorruption Layer(ACL) 수준으로 흡수**하는 단순 통합.

근거: methodology-ddd.md Context Mapping 9개 관계 패턴 중 프로젝트 경계 내 BC 분리 불필요 (Blog 도메인 단일).

## 기술 스택

### [확정] 런타임 / 프레임워크 계층 — NestJS 10 + TypeScript 기반 유지

결정: 기존 확정된 스택 유지 — NestJS 10 (@nestjs/common/core/platform-express ^10.0.0), TypeScript ^5.1.3, Node.js 런타임 (Phase 0에서 버전 선언 예정) [확정]

근거: context.md [기술 스택 제약] 기존 구현 기반 + TP7(BP5 선행 기반 확보) + 프로젝트 학습 목표가 "비동기 시스템 적용" 자체이지 프레임워크 전환이 아님. NestJS 11 업그레이드는 Phase 5 TP8 범위로 분리.

기각 대안: (1) NestJS 11 선제 업그레이드 — Express v5 경로 매칭 / CacheModule Keyv 전환 등 breaking change 대응 비용이 Phase 1 범위 압박. Phase 5에 통합하여 "프로덕션 품질 개선"의 서사로 학습 가치 확보가 더 정합. (2) 다른 프레임워크 전환(Fastify 네이티브 등) — 기존 코드 재작성 비용 과다, 학습 목표와 무관

파급 효과: `@nestjs/swagger ^7.1.16` 등 서브 패키지도 Phase 5까지 버전 유지. Phase 3 async Extension에서 채택할 cache-manager(v5 + cache-manager-ioredis 어댑터)가 NestJS 10 호환 범위 내에서 설계. NestJS 11의 CacheModule Keyv 전환은 Phase 5 마이그레이션 대상.

### [확정] 영속 저장소 — MySQL 8.0 + Redis 유지

결정: DB는 MySQL 8.0 (InnoDB), 캐시/세션/비동기 브로커 일부는 Redis 유지 [확정]

근거: context.md [기술 스택 제약] 기존 Docker Compose 구성 + TP1 비동기 처리 계층 도입 시 Redis가 cache-aside 계층 및 Idempotency Key 저장소로 활용 (TP3 처방 패턴)

기각 대안: (1) PostgreSQL 전환 — 기능적 이점(JSON/부분 인덱스 등) 있으나 학습 목표가 DB 기술 전환이 아님. 마이그레이션 비용 대비 가치 낮음. (2) Redis 대체(Memcached 등) — 자료구조 표현력 및 pub/sub·Streams 지원 측면에서 Redis 우위, Kafka 도입 전 중간 단계 브로커로도 활용 가능

파급 효과: data-design.md 관계 모델은 InnoDB 참조 무결성(FK) 전제. Phase 3 작업 큐가 Redis 기반이 될 경우 애플리케이션 캐시와 큐 데이터 분리 정책 필요 (db index 또는 key prefix) → async Extension에서 상세.

### [확정] 부하 테스트 도구 — k6 채택

결정: k6 채택 [확정]

근거: context.md [참고 서비스/벤치마크 → 업계 가이드라인] + 미팅 로그 2026-04-24 Q4 답변 (NestJS 실무 권장 도구) + Grafana Labs 공식 지원으로 관측성(Grafana Dashboard)과 통합 가능

기각 대안: (1) Gatling — Scala 기반 러닝 곡선, JVM 런타임 부담. (2) Artillery — JavaScript 기반으로 친숙하나 대규모 시나리오에서 k6 대비 기능 제한. (3) JMeter — GUI 기반이라 Git 관리/재현성 저해

파급 효과: Phase 4/5의 부하 테스트 시나리오는 k6 스크립트로 작성 (JavaScript/TypeScript). Phase 2 관측성 스택과 통합(k6 → Prometheus Remote Write → Grafana 또는 k6 Cloud Dashboard)은 observability Extension에서 선정.

### [확정] 부하 테스트 시각화 스택 — k6 → Prometheus Remote Write → Grafana

결정: k6 → Prometheus Remote Write (k6 v0.42+ experimental output) → Grafana 동일 대시보드. Phase 2 관측성 스택과 통합 [확정]

근거: observability.md §2.5 Prometheus + Grafana 채택 [확정] 충족 (LGTM 스택 일관성) + observability.md §7.1 k6 결과 → Prometheus Remote Write [확정] + Phase 4/5 비교의 시각화 일관성 (단일 플랫폼에서 운영 대시보드와 부하 테스트 결과 동시 조회) + k6 공식 v0.42+ Remote Write Output 지원

기각 대안: (1) k6 Web Dashboard(k6 v0.49+ 내장) — 부하 테스트 결과만 시각화, 관측성 스택과 분리되어 before/after 비교 시 컨텍스트 전환 비용. (2) k6 Cloud Dashboard — SaaS 의존 + 비용 + 학습 프로젝트 out-of-scope

파급 효과: Phase 4 진입 시 k6 실행 옵션 `--out experimental-prometheus-rw=http://prometheus:9090/api/v1/write` 표준 사용. Phase 5 재측정도 동일 옵션 유지 (비교 기준 변화 방지). 관측 오버헤드 측정 시(observability.md §7.3) k6 자체의 Remote Write도 일시 비활성화하여 순수 서버 비교 가능

## Phase 정의

problem.md Phase 근거 섹션을 따른다. 각 Phase의 해결 대상·근거·감수 제약·범위 외(인접 Phase 위임)는 problem.md 참조. 본 섹션은 각 Phase의 의도와 범위 요약만 제공한다 — 부정형 경계의 1차 진실은 problem.md.

- **Phase 0**: 기반 확보 (BP5 / TP7) — *비동기화/관측성 Phase 진입 + Phase 1 대규모 스키마 변경 진입 게이트.* Node 버전 선언 + 불필요 의존성 정리 + **migrations 활성화 (synchronize:false 전환)**. PR 사이클에서 발견된 기반 결함도 본 Phase에서 흡수 (plan-manager 운영 정의: "Phase 1 진입 게이트 + 발견된 결함 정리")
- **Phase 1**: 기능 완성 + 도메인 재정비 (BP3 / TP3·TP4·TP5) — *기능 완성의 첫 마일스톤. Phase 1~3 누적이 곧 기능 완성.* 댓글·답글·중복 요청 방지 + 커서 페이징 + User 식별자 재설계. Phase 0에서 활성화된 migrations 인프라 위에서 데이터 보존형 마이그레이션 스크립트 작성
- **Phase 2**: 관측성 가시화 (BP4 / TP6) — *측정 사이클의 전제 인프라. 측정 사이클 자체는 Phase 4.* Correlation ID, 메트릭/트레이싱, 대시보드
- **Phase 3**: 비동기화 (BP1 / TP1) — ***기능적 구현의 마지막 단계. Phase 3 종료 시 모든 기능 완성, Phase 4가 측정할 시스템 형상 확정.*** 캐시/큐/Kafka + 알림 비동기 신규 + 집계 비동기 전환. 이후 Phase 4·5는 새 기능 도입 봉인
- **Phase 4**: 부하 테스트 1차 (BP2 / TP2) — ***Phase 5 재측정과의 before/after 비교 기준점.*** Baseline + Load + Stress, Spike 조건부. 측정 환경 안정성 보호 — 측정 중 코드 변경(기능 추가, 비동기 패턴 추가, 품질 개선) 금지
- **Phase 5**: 품질 개선 + 재측정 2차 (BP6 + BP2 / TP8) — ***Phase 4 baseline 대비 동일 시나리오 재측정 비교를 위한 프로덕션 품질 개선*** (단순 버전 업데이트 아님). argon2id/AES-GCM + 메이저 업그레이드(NestJS 11, TS 6, Jest 30) + RFC 9457 응답 표준 전환 + 동일 시나리오 재측정. **Phase 0 영역(Node 버전, migrations 활성화, 의존성 정리, 기반 결함 흡수)을 본 Phase로 이관 금지** — Phase 0 인프라 위에서 데이터 마이그레이션·메이저 업그레이드 수행이 본 Phase 활동

각 Phase는 독립 Phase 진입 시점에 해당 Phase 범위의 Problem/Solution 재작성을 수행하여 "알려진 불확실성"을 해소하며 진행 (MCPSI 공통 변경 관리 정책 — ADR supersede 패턴).

## Extension 적용 계획

Phase 6 Core 출력 — 적용 Extension 판별 결과:

- **async**: 적용 — TP1 (EDA + Publisher-Subscriber), cross-Aggregate 이벤트 다수 (PostViewed / PostLiked / CommentCreated 등), Phase 3 핵심
- **security**: 적용 — TP8 Phase 5 확정 범위 (bcrypt/argon2, AES-GCM, 쿠키/시크릿 관리 재정비). API 수신 Idempotency 측면도 security 소관 (§6 소유권 매트릭스)
- **observability**: 적용 — TP6 Phase 2 확정 범위, AntiPattern "Blind Faith" 해소의 primary
- **infra** (infra-network + environment): 미적용 — 배포 모델 "로컬 단독 / POC" (Docker Compose). Problem Out-of-scope "클라우드 배포 및 관련 인프라 설계"로 확정. Core는 "의도적 생략 + 근거: 로컬 POC" 기록. 클라우드 배포 트리거(알려진 불확실성 6) 충족 시 별도 편입
- **risk**: 미적용 — 개인 학습 프로젝트, 안전 중대/고가용성(SLA 99.99%+)/금융(PCI-DSS)/의료(HIPAA)/규제(KISA CSAP/ISMS) 모두 비해당
- **frontend**: 미적용 — Problem Out-of-scope "프론트엔드/모바일 앱"
- **refactor**: 미적용 — 레거시 운영 모드이나 Phase별 점진 리팩토링 수준, Strangler Fig/대규모 병렬 운영 요구 없음. Core 내 Kerievsky 3방향 결정(application-arch.md §3방향 리팩토링) 및 각 Phase 내부 리팩토링으로 충분

### 순차 실행 권장 순서

async → security → observability → (infra 미적용) → (risk 미적용) → (frontend 미적용) → (refactor 미적용)

근거: downstream Extension(security/observability)이 async가 정의한 이벤트 경계·Idempotency(이벤트 수신 측)를 포인터로 참조. async 선행 시 포인터 연결만으로 충분.

## 후속 Phase 인계 메모

다음 항목은 Core 범위가 아닌 후속 Phase/단계에서 처리:

- **implementation-guide.md**의 "Phase 산출 문서" 섹션: CLAUDE.md "기술 블로그 문서화 규칙"에 따라 Phase별 Type A(설계) / Type B(회고) 블로그 이슈 선언. 각 Phase 진입 시 Implementation 단계에서 확정 (미팅 로그 2026-04-24 결정 3·4·5)
- **issue-plan.md**의 narrative 타입 이슈: Type A/B 독립 이슈 생성 + `depends_on` / `pair_with` / `aggregates` 필드 반영
- **기존 14개 열린 이슈 재분류**: Phase 편입 대상 여부를 Implementation 단계의 "기존 마일스톤/이슈 정리" 절차에서 확정 (미팅 로그 결정 2)
- **각 Phase 진입 시 Problem/Solution 재작성**: 현 Phase 근거 범위가 확정된 뒤 해당 Phase의 알려진 불확실성(3·4·5·8 등)이 해소되는 시점에 상세화

## Core 산출물 요약 (Extension 입력 참조)

- A 카테고리 파일: docs/solution/overview.md, application-arch.md, data-design.md
- async-processing.md: async Extension 생성 예정
- 핵심 Aggregate: User, Post (상세는 application-arch.md §Aggregates)
- Command→Event 매핑: application-arch.md §Aggregate 섹션에 cross-Aggregate 이벤트 명시 (async Extension 입력)
- 채택 패턴: EDA + Publisher-Subscriber, Idempotency Key, Identity Separation + Account Linking, Interceptor + AsyncLocalStorage, Expand-and-Contract + Lazy Migration, Load Testing Methodology + User Journey Scenario, Cursor-based Pagination, Adjacency List (상세는 application-arch.md §채택 패턴)
- 3방향 리팩토링 결정: User Aggregate 재설계는 Refactoring Towards Patterns [확정]
- 배포 모델: 로컬 단독 / POC (Docker Compose)

## Sources

- docs/context.md (비즈니스 맥락, 기술 제약, 알려진 불확실성 전체)
- docs/problem.md (BP1~BP6, TP1~TP8, UC-1~7, Invariant 12, Phase 근거 — 각 Phase 범위 외 부정형 경계 포함)
- docs/meeting-logs/2026-04-24.md (결정 1-7, 미결정 1-4 — MCPSI 신규 수립)
- docs/meeting-logs/2026-04-29.md (결정 1-5, 미결정 1-3 — Phase 정의 의도 명문화 + 부정형 경계 정책 수용)
- 본 프로젝트 PR #83 사이클: 커밋 11270a2, 3e7045b (#86 영역 정합 정정 — Phase 5 deferred → Phase 0 통합 사례, Phase 5 의도 명문화의 트리거)
- docs/tech-notes/token-validation-strategies.md (Phase 0 auth baseline)
- 방법론 근거:
  - Vernon "Implementing Domain-Driven Design" (2013) 4 Rules — Aggregate 설계
  - methodology-ddd.md Context Mapping 9 패턴
  - Molyneaux "The Art of Application Performance Testing" (2014) — 부하 테스트 유형 분류
  - IEEE 29148:2018 §6 / Wiegers & Beatty "Software Requirements" 3e Ch.5 — Phase 근거 부정형 경계 정책 (problem.md 1차 적용)
