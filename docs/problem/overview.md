# Problem — Overview

비즈니스 문제·기술 문제·Pattern Selection 인지층·Phase 근거·해결 범위. 도메인 의미 명세(Invariant/Decision Table/State Machine)는 domain-spec.md, Use Case는 use-cases.md. NFR/Threat 활성 판정 결과는 본 문서 말미.

## 비즈니스 문제

### BP1. 비동기 시스템 적용 경험 부재

- 대상: 개발자 본인 (학습 목표)
- 현상: 모든 처리가 동기로 이뤄짐 (조회수 증가, 좋아요 집계 등). 애플리케이션 레벨 캐시 계층 없음 (TypeORM 쿼리 캐시만 존재). 작업 큐/이벤트 기반 처리 없음. Kafka 미도입. 알림 기능 자체가 미구현.
- 영향: 백엔드 역량 성장 목표의 핵심 가치 영역 미경험. 실제 서비스에서 필수인 비동기 패턴의 설계/구현/운영 경험 부재
- 성공 지표:
  - Redis 애플리케이션 캐시 도입 (MCPSI solution 확정 + 구현 머지 + 설계 근거 문서화)
  - 작업 큐 기반 비동기 작업 처리 도입 (구체 기술은 Solution 단계에서 확정)
  - Kafka 이벤트 기반 비동기 처리 도입
  - 각 기술의 도입 판정은 산출물 세트 완료 (편수 강제는 없음 — context의 성공 지표 원칙)

### BP2. 성능 검증 사이클 경험 부재

- 대상: 개발자 본인
- 현상: 부하 테스트 수행 이력 없음. 측정 기반 튜닝 이력 없음. 베이스라인 수치 부재
- 영향: 학습 목표의 핵심인 "부하 테스트 기반 성능 튜닝 경험" 미달성. 비동기화 도입 효과를 정량화할 수 없음
- 성공 지표:
  - k6 기반 부하 테스트 환경 구축 + 비주얼라이저(구체 스택은 Solution에서 결정)
  - Phase 4: "베이스라인 측정 → 튜닝 → 재측정" 1차 사이클 완수
  - Phase 5: 프로덕션 품질 개선 후 재측정 2차 사이클 완수 (Phase 4 결과와 before/after 비교)

### BP3. 기능 불완전으로 비동기 실험 대상 축소 + 도메인 정합성 부족

- 대상: 개발자 본인 + 잠재 외부 독자(블로그)
- 현상:
  - 핵심 미구현 기능: 댓글 (#6), 답글 (#7), 중복 요청 방지 (#11)
  - 글 목록 조회가 offset 페이징 (깊은 페이지 성능 저하 + 동시 쓰기 중 중복/누락 위험)
  - User 식별자 설계 부재 — 일반 가입 uid는 사용자 선택 ID, Google OAuth uid는 이메일. 동일인 식별 기반 없음. uid가 로그인 ID + 외래키 + 이메일의 3역할 혼재
- 영향:
  - (1) 블로그 서비스가 기능적으로 미완결되어 비동기화 실험 대상도 축소됨
  - (2) 커서 전환 없이 부하 테스트하면 offset 한계가 다른 튜닝 효과를 가려서 측정 왜곡
  - (3) OAuth 사용자와 일반 가입 사용자가 실제로 동일인이어도 시스템에서 별개로 관리되어 향후 기능(알림, 통계 등) 구현 시 왜곡
- 성공 지표:
  - 댓글/답글/중복 요청 방지 구현 완료
  - 글 목록 조회가 커서 페이징으로 전환 완료
  - User 식별자 체계 재설계 완료 (이상적 본인인증 CI의 비용 제약 하에서 차선책 대안 적용)

### BP4. 시스템 관측성 부재로 비동기화 성과 측정 불가

- 대상: 개발자 본인
- 현상:
  - 구조화 로깅은 있지만 Correlation ID 전파 없음 (#10, #60)
  - 메트릭/트레이싱 계층 부재
  - 운영 대시보드 부재 (#40)
- 영향:
  - 비동기화 도입 전/후 성능 비교가 감으로만 가능
  - 병목 지점 식별 불가 → 튜닝 근거 부재
  - Phase 4 부하 테스트 결과를 해석할 수집 인프라 없음
- 성공 지표:
  - Correlation ID 생성/전파 완료 (요청 경로 전체 + 로그/메트릭/트레이스에 연결)
  - 메트릭 수집 및 대시보드 구축 (구체 스택은 Solution 단계 선정 — Prometheus/Grafana/OpenTelemetry 후보군)
  - 주요 엔드포인트의 latency/throughput 관측 가능한 상태

### BP5. 비동기화/관측성 도입의 선행 기반 부재 (Phase 0에서 해소 완료, 2026-05-11)

- 대상: 개발자 본인 + 장래 협업자 재현성
- 현상 (Phase 0 진입 시점):
  - Node.js 런타임 버전 선언 누락 (.nvmrc, package.json engines, CI workflow 전부 미선언)
  - 사용되지 않는 `redis` 의존성 선언
  - TypeORM `synchronize: true` 운영, migrations/ 디렉토리 존재하나 파일 없음 — 스키마 변경 이력 추적/롤백 불가, 데이터 보존형 마이그레이션 불가
- 영향:
  - 재현성/CI 리스크 — 개발자 로컬 환경에 암묵 의존
  - Jest 30 등 상위 도구 도입 시 Node 버전이 선행 조건
  - Phase 1의 대규모 스키마 변경(User Aggregate 재설계 — uid VARCHAR → user_id BIGINT FK 전파, user_auth_provider 신설, 외래키 재배치)이 synchronize로는 데이터 손실 없이 처리 불가 → migrations 활성화가 Phase 1 선행 조건
  - 관측성/비동기화 Phase 진입 전에 환경 기준 필요
- 성공 지표 (모두 달성):
  - ✅ Node 버전 세 지점 일관 선언 (.nvmrc + package.json engines + CI workflow node-version) — #75
  - ✅ 의존성 정리 (`redis` 미사용 의존성 제거) — #76
  - ✅ migrations 활성화 (`synchronize:false` 전환 + InitialSchema export + E2E globalSetup runMigrations) — #79
  - ✅ HealthModule E2E 격리 부트 + RedisHealthIndicator ioredis Provider inject — #77, #85, #86
  - ✅ gitleaks pre-commit 훅 — #78
  - ✅ 전역 ValidationPipe path 파라미터 NaN 변환 결함 수정 — #89

### BP6. 프로덕션 수준 코드 품질 개선을 통한 학습 가치 확보

- 대상: 개발자 본인
- 현상:
  - 비밀번호 해싱: SHA256 3회 반복 (업계 표준 bcrypt/argon2 미사용)
  - PK 암호화: AES-ECB 모드 (패턴 노출 취약)
  - 스키마 관리: synchronize:true (migrations/ 디렉토리 존재하나 파일 없음)
  - 의존성 메이저 갭: NestJS 10→11, TypeScript 5→6, Jest 29→30
  - 응답 포맷: "HTTP 200 + body 내 ErrorCode" 자체 컨벤션 (RFC 9457 Problem Details 미채택). Spring Boot 3+ / ASP.NET Core 7+는 native 표준화된 영역이지만 NestJS는 자체 구현 영역 — 학습 프로젝트 응답 인프라가 표준 미준수
- 영향:
  - 현 상태로 프로덕션 확장 불가 (보안/운영 표준 미충족)
  - "프로덕션 품질이 성능에 미치는 영향" 측정 기회 미활용 — Phase 4 결과와 Phase 5 결과를 비교하면 학습 가치 큼
  - API 컨슈머가 표준 라이브러리(예: ProblemDetailsClient)를 활용 불가, 자체 매핑 강제
- 성공 지표:
  - bcrypt 또는 argon2로 비밀번호 해싱 전환 + 기존 사용자 마이그레이션 전략 수립/실행 (Lazy Migration)
  - AES-GCM 또는 AES-CBC로 PK 암호화 전환 + 기존 데이터 재암호화 전략
  - 위 두 전환을 Phase 0에서 활성화된 migrations 인프라 기반 스크립트로 수행
  - 의존성 메이저 업그레이드 (NestJS 11, TypeScript 6, Jest 30) 단, Phase 5 범위 확정 시 주요 breaking change 대응 필요
  - **RFC 9457 Problem Details 전환 완료**: 모든 에러 응답이 `application/problem+json` + 표준 HTTP status code(4xx/5xx) 형식. ErrorCode → status 매핑 체계 + ExceptionFilter 3종 재작성 + Swagger 응답 스키마 갱신 + E2E 테스트 응답 검증 갱신
  - Phase 5 완료 후 Phase 4와 동일 시나리오 부하 테스트 재측정

## 기술 문제

### TP1. 비동기 처리 계층 부재

- 파생: BP1
- 기술적 도전:
  - 애플리케이션 레벨 캐시 전략 설계 (cache-aside / read-through / write-through 중 선택)
  - 작업 큐 기반 비동기 작업 처리 (조회수 집계, 좋아요 집계, 알림 발송 등)
  - 이벤트 기반 아키텍처 (Kafka 등) 설계 — 이벤트 계약(스키마), 파티션 전략, 순서 보장, Idempotency, DLQ 정책
  - 알림 기능을 처음부터 비동기로 설계 (동기 구현 생략)
  - 기존 동기 집계(`Hits` 증가, PostLike count)를 비동기로 전환하는 마이그레이션 전략
- 제약:
  - 단일 개발자 / 로컬 Docker Compose / 기존 NestJS 10 기반 / cache-manager v5 + cache-manager-ioredis 어댑터 (NestJS 11 업그레이드 시 Keyv 전환 영향)
- 근거 카테고리:
  - Forces 충돌 F1: 사용자 응답성 vs 동기 처리 완결성
  - Forces 충돌 F6: 비동기화 대상 존재 vs 선행 기능 필요 (알림 비동기화가 댓글/답글 기능 전제)
  - Causes of Redesign 4: Dependence on object representations — 좋아요 집계가 PostLike 직접 count
  - Causes of Redesign 5: Algorithmic dependencies — 조회수/집계가 요청 트랜잭션에 결합
  - Causes of Redesign 6: Tight coupling — 요청-처리-집계 단일 흐름

### TP2. 부하 테스트 환경 및 측정 체계 부재

- 파생: BP2
- 기술적 도전:
  - k6 스크립트 작성 (시나리오별, 예: 인증 → 글 조회 → 좋아요)
  - 측정 대상 엔드포인트 식별 (전체 16개 중 성능 민감 후보)
  - 베이스라인 수치 수립 방식 (목표 규모 가정 → RPS/p99 latency/동시 사용자 산정)
  - 측정 결과 시각화/저장 (Grafana + InfluxDB / k6 Web Dashboard / Prometheus Remote Write 중 선택)
  - 관측성 Phase와의 통합 (k6 결과를 같은 대시보드에 표시)
  - 측정 결과 이력 관리 (Phase 4 vs Phase 5 비교를 위한 기록)
- 제약:
  - 목표 규모(RPS, 동시 사용자) 미확정 (알려진 불확실성 3)
  - 로컬 장비의 자원 한계 — 측정 결과의 대외 재현성 제한
- 근거 카테고리:
  - Forces 충돌 F3: 측정 정확성 vs 로컬 장비 한계
  - Causes of Redesign 3: Dependence on hardware and software platform — 로컬 측정 결과의 재현성 한계

### TP3. 미구현 기능 (댓글/답글/중복 요청 방지)

- 파생: BP3
- 기술적 도전:
  - 댓글 CRUD 설계 (글과의 관계, 작성/수정/삭제 권한, 소유권 기반 CASCADE)
  - 답글 CRUD (댓글의 자기 참조 관계 또는 별도 엔티티, 계층 깊이 제한)
  - 중복 요청 방지 (Idempotency Key 패턴 — 클라이언트 제공 키 + 서버 캐시 기반 중복 감지)
  - 기존 도메인 모델 (PK 암호화 흐름, PostEntity 외래키 체계)과의 통합
- 제약:
  - 현 UserAuth 식별자 이슈 해소 후 통합해야 외래키 설계 반복 방지 (TP5와 순서 결합)
- 근거 카테고리:
  - Forces 충돌 F6: 기능 존재 선행 필요
  - Causes of Redesign 7: Extending functionality — 기능 확장 지점 설계 부재

### TP4. 페이징 일관성/성능 한계

- 파생: BP3
- 기술적 도전:
  - 커서 기반 페이징 전환 (last item의 `postId` 또는 `writeDatetime` 활용)
  - 정렬 기준과 커서 키의 정합 (최신순 정렬이면 writeDatetime DESC 기반 커서)
  - API 계약 변경 (기존 `page` 파라미터 → `cursor` 파라미터)
  - Swagger 문서 갱신 + E2E 테스트 개정
- 제약:
  - 기존 프론트엔드/클라이언트와의 호환성은 학습 프로젝트라 고려 대상 아님
- 근거 카테고리:
  - Causes of Redesign 5: Algorithmic dependencies — offset 계산이 데이터 크기에 의존
  - Causes of Redesign 4: Dependence on object representations — 페이지 번호로 position을 표현

### TP5. User 식별자 설계 부재 (동일인 식별 기반)

- 파생: BP3
- 기술적 도전:
  - 내부 영구 식별자(userId) 도입 vs 기존 uid 유지의 트레이드오프
  - Google OAuth의 uid가 이메일인 현 구조 → 일반 가입과 OAuth 가입 간 동일인 식별 불가
  - 이상적 해결책(본인인증 CI API)은 유료 서비스라 학습 프로젝트에서 부적합 — 차선책 설계 필요
  - 차선책 후보: (a) email 기반 연동 (기존 UserAuth에 email 추가, OAuth email과 대조) (b) 사용자 수동 계정 연결 기능 (c) 현 구조 유지 + 중복 가입 수용
  - 외래키 전파 영향 (PostEntity.postUid, PostLikeEntity.uid 등이 userId를 참조하도록 재배치되는지)
  - 기존 데이터 마이그레이션 (없으므로 리스크 낮음, 학습 프로젝트 이점)
- 제약:
  - 유료 본인인증 API는 개인 학습 프로젝트 예산 초과
  - 도메인 모델 리팩토링이 댓글/답글 구현(TP3) 선행 조건 — 동일 Phase 내 순서 결합
- 근거 카테고리:
  - Forces 충돌 (신규): "이상적 식별 기반 (본인인증 CI)" vs "학습 프로젝트 예산 제약"
  - Causes of Redesign 4: Dependence on object representations — uid가 로그인 ID + 이메일의 두 표현을 겸함
  - Smell (Kerievsky): Oddball Solution — OAuth의 uid가 이메일인 처리가 일반 가입 경로와 규칙 일관성을 깨뜨림

### TP6. 관측성 인프라 부재

- 파생: BP4
- 기술적 도전:
  - Correlation ID 생성/전파 (NestJS Interceptor 또는 Middleware → AsyncLocalStorage 기반 컨텍스트)
  - Winston 로그 포맷 확장 (Correlation ID 필드, 요청 메타데이터)
  - 메트릭 수집기 도입 (Prometheus exporter / OpenTelemetry SDK 중 선정) — HTTP 요청 메트릭, DB 쿼리 메트릭, 커스텀 비즈니스 메트릭
  - 트레이싱 계층 (OpenTelemetry auto-instrumentation + Jaeger/Tempo 수집기)
  - 대시보드 구축 (Grafana) — 실시간 요청 현황, latency 분포, 에러율
  - 비동기 작업(큐, Kafka) 관측 (consumer lag, DLQ 현황)
- 제약:
  - 로컬 환경 제약 (메모리/CPU 여유)
  - 관측 오버헤드가 튜닝 대상 성능에 영향을 줄 수 있음
- 근거 카테고리:
  - Forces 충돌 F4: 개발 단순성 vs 성능 분석 가능성
  - Causes of Redesign 6: Tight coupling — 로깅이 Winston에만 결합
  - Smell: Shotgun Surgery — Correlation ID 도입 시 로그 호출 지점 다수 수정 필요
  - AntiPattern (Architectural): Blind Faith — 관측 없이 시스템 정상성 가정

### TP7. Phase 0 기반 확보 (Node 버전 + 의존성 정리 + migrations 활성화) — Phase 0 종료(2026-05-11) 시점 해소 완료

- 파생: BP5
- 기술적 도전:
  - Node.js 런타임 버전 세 지점 일관 선언 (.nvmrc 신설, package.json engines 필드 추가, GitHub Actions workflow node-version 명시) — Node 22.x LTS 선택
  - `redis` 의존성 제거 또는 역할 문서화 — 제거 채택
  - **TypeORM migrations 활성화**: `synchronize:false` 전환, 현 스키마를 기준 마이그레이션 파일로 export. Phase 1부터 모든 스키마 변경은 migration 파일로 작성 전제
  - PR 사이클 발견 결함 흡수: HealthModule 자기완결성, RedisHealthIndicator 단일 ioredis Provider inject, ValidationPipe path 파라미터 NaN 결함
- 제약:
  - Node 버전 변경이 기존 개발자 환경에 영향 (1인 프로젝트라 현실적 제약 낮음)
  - migrations 활성화 이후 Phase 1 User Aggregate 재설계 스키마 변경은 데이터 보존형 마이그레이션 로직(기존 uid → user_id 매핑, OAuth 사용자 식별) 작성 필수 — Phase 1 첫 작업으로 편입
- 근거 카테고리:
  - Causes of Redesign 3: Dependence on hardware and software platform — 런타임 버전 미선언
  - Causes of Redesign 8: Inability to alter classes conveniently — synchronize:true로 스키마 변경 추적 불가, 데이터 보존 변경 불가
  - AntiPattern (Managerial): Blind Faith — 환경 기준 없이 로컬 의존

### TP8. 프로덕션 수준 품질 갭 (보안/운영 표준)

- 파생: BP6
- 기술적 도전:
  - 비밀번호 해싱 전환: SHA256 3회 반복 → bcrypt 또는 argon2. 기존 사용자 재해싱 전략 (Lazy: 로그인 시점 재해싱 / Eager: 일괄 마이그레이션)
  - PK 암호화 전환: AES-ECB → AES-GCM 또는 AES-CBC. 암호화 파라미터 변경에 따른 기존 암호문 재암호화
  - 위 두 전환을 위한 데이터 마이그레이션 스크립트 작성 (migrations 인프라는 Phase 0에서 선행 완료된 상태 전제)
  - 의존성 메이저 업그레이드:
    - NestJS 10→11: Express v5 경로 매칭, CacheModule Keyv 전환, Reflector 반환 타입, 종료 lifecycle hook 순서
    - `@nestjs/swagger` 7→11: NestJS 11과 함께 업그레이드
    - TypeScript 5→6: 마지막 JS 기반 릴리스 (7 Beta 대기)
    - Jest 29→30: Node 18+ 필수 (Phase 0의 Node 선언이 선행 조건)
  - Swagger 문서 품질 개선 — v11 환경에서 새로 정립. `@ApiParam`/`@ApiQuery` 전수 추가, `nest-cli.json`에 `@nestjs/swagger` CLI plugin 활성화, 미문서화 DTO에 `@ApiProperty` 보강, 응답 스키마 표현 일관화(현재 `successResponseOptions`와 `@ApiResponse` 혼재), `SuccessResponse`/`FailureResponse` 제네릭 정립. 기존 이슈 #45 처리
  - **RFC 9457 Problem Details 전환**: 응답 포맷을 `application/problem+json` + 표준 HTTP status code(4xx/5xx)로 전환. 현 "HTTP 200 + body 내 ErrorCode" 컨벤션 폐기 (Reinvent the Wheel AntiPattern 해소). ErrorCode → status code 매핑 체계 신설 (도메인별 5자리 enum은 errorCode 확장 필드로 보존하여 클라이언트 매핑 호환). ExceptionFilter 3종(BaseException/HttpException/Unhandled) 재작성. E2E 테스트 응답 검증 로직 전수 갱신 (HTTP 200 단일 가정 → status code별 분기). Swagger 응답 스키마(@ApiResponse) 전수 갱신과 통합. 결정 상세는 docs/solution/observability.md §6.2
  - Phase 4와 동일 시나리오 부하 테스트 재측정
- 제약:
  - 학습 프로젝트 범위 내 완수 가능해야 함 — 업그레이드 breaking change 대응 비용이 범위 초과하면 일부 항목만 선택
  - bcrypt/AES-GCM 전환은 Phase 0에서 활성화된 migrations 인프라를 이용해 데이터 마이그레이션 스크립트로 수행
  - RFC 9457 전환은 NestJS 11 + @nestjs/swagger 11 업그레이드와 동시 수행 (응답 인프라 일괄 변경, 호환성 깨짐 시점 일원화)
- 근거 카테고리:
  - Forces 충돌 F2: 학습 가치 최대화 vs 구현 완성 시간
  - Causes of Redesign 3: Dependence on hardware and software platform (Node 버전, 의존성)
  - Causes of Redesign 8: Inability to alter classes conveniently — synchronize:true로 스키마 변경 추적 불가
  - Smell (Kerievsky): Oddball Solution — SHA256 3회 반복 해싱 + HTTP 200 + body ErrorCode 컨벤션 (RFC 9457 표준 대체)
  - AntiPattern (Architectural): Reinvent the Wheel — 자체 해싱 구현 + 자체 응답 컨벤션 (Spring Boot 3+/ASP.NET Core 7+ native 표준이 사실상 존재)

## Pattern Selection 근거 카테고리

프로젝트 모드: 레거시 운영/유지보수 (기존 코드 위에 기능 추가 + 품질 개선 혼재 — context/constraints.md "기존 코드 상태" 기록 존재 + BP6 코드 품질 개선이 비즈니스 문제로 포함)

각 TP의 근거 카테고리는 해당 TP 항목에 인라인 명시. 본 섹션은 enumerate (Solution 패턴 선정 입력으로 사용).

Forces 충돌 (Alexander):
- F1 사용자 응답성 vs 동기 처리 완결성 — 희생 시 손실: 응답성↓ 또는 처리 완결성↓ (TP1)
- F2 학습 가치 최대화 vs 구현 완성 시간 — 희생 시 손실: 학습 깊이↓ 또는 범위 미완수 (TP8)
- F3 측정 정확성 vs 로컬 장비 한계 — 희생 시 손실: 대외 재현성↓ (TP2)
- F4 개발 단순성 vs 성능 분석 가능성 — 희생 시 손실: 관측 오버헤드↑ 또는 튜닝 근거 부재 (TP6)
- F5 이상적 식별 기반(본인인증 CI) vs 학습 프로젝트 예산 제약 — 희생 시 손실: 동일인 식별 정확도↓ 또는 예산 초과 (TP5)
- F6 비동기화 대상 존재 vs 선행 기능 필요 (알림이 댓글/답글 기능 전제) — 희생 시 손실: 비동기 실험 대상 축소 (TP1, TP3)

Causes of Redesign (GoF, 8 항목 중 매칭):
- 3 Dependence on hardware/software platform — TP2, TP7, TP8
- 4 Dependence on object representations — TP1 (PostLike count), TP4 (offset position), TP5 (uid 다중 역할)
- 5 Algorithmic dependencies — TP1 (조회수 동기 트랜잭션 결합), TP4 (offset 계산)
- 6 Tight coupling — TP1 (요청-처리-집계 단일 흐름), TP6 (로깅 Winston 결합)
- 7 Extending functionality — TP3 (기능 확장 지점 설계 부재)
- 8 Inability to alter classes conveniently — TP7, TP8 (synchronize:true)

Smell (Fowler/Kerievsky, 레거시 모드 활성):
- Oddball Solution — TP5 (OAuth uid가 email), TP8 (SHA256 3회 반복 해싱, HTTP 200 + body ErrorCode 컨벤션)
- Shotgun Surgery — TP6 (Correlation ID 도입 시 로그 호출 지점 다수 수정)

AntiPattern (Brown, 레거시 운영 모드 활성):
- Blind Faith (Managerial) — TP6 (관측 없이 시스템 정상성 가정), TP7 (환경 기준 없이 로컬 의존)
- Reinvent the Wheel (Architectural) — TP8 (자체 해싱 + 자체 응답 컨벤션)

## 해결 범위

### In-scope

- BP1~BP6 전체 (Phase 0~5로 분산). BP2는 Phase 4(1차 사이클 — 비동기화 후 베이스라인)와 Phase 5(2차 사이클 — 프로덕션 품질 개선 후 재측정)에 걸쳐 해결
- 관련 기술 문제 TP1~TP8 전체
- 기존 14개 열린 이슈 중 Phase 편입 대상의 재분류 (Phase 근거 확정 후 /mcpsi-implementation 단계에서 수행)

### Out-of-scope

- 클라우드 배포 및 관련 인프라 설계 — 트리거 조건: 배포 예산 확보 (알려진 불확실성 6)
- 본격 CI 파이프라인 구축 (자동 빌드/테스트, PR 별 부하 테스트 트리거 등) — Phase 0에서 Node 버전 선언까지만. 본격 구축은 배포 목표 확정 시 별도 수립
- 데이터베이스 샤딩 — 학습 가치 크나 이번 프로젝트 범위 초과. 부하 테스트에서 샤딩 필요성이 실증되면 별도 후속 프로젝트로 편입
- 본인인증 CI API (KISA 본인확인 서비스 등) — 유료 서비스, 학습 프로젝트 예산 초과. TP5에서 차선책으로 대체
- ADMIN vs USER 역할 차등 권한 정의 — 현 구현에서 @Roles(USER)/@Roles(USER, ADMIN)의 실질 차이는 @Roles 매칭 외 없음. 학습 목표(비동기/부하테스트)와의 연결이 약하고 Phase 1 범위 확대 회피. 트리거 조건: 관리자 기능(댓글 모더레이션, 사용자 관리 등)이 필요해지는 시점. 재편입 시 Decision Table 적용 가치 발생 가능 (조건 조합: 역할 + 소유권 + 리소스 종류)
- 추가 기능 (팔로우, 검색, 태그, RSS 등) — 이번 프로젝트는 비동기 학습 목표 달성에 필요한 기능만
- 프론트엔드/모바일 앱 — 백엔드 API만 대상. 수동 검증은 Swagger UI(기본 제공) + Postman/Bruno 컬렉션, 자동 회귀는 supertest E2E, 성능 측정은 k6으로 대체

## Phase 근거

프로젝트 모드: 레거시 운영/유지보수 (Phase 2.5.0 판별 결과 — 기존 코드 위에 기능 추가 + 품질 개선 혼재)

비즈니스 우선순위와 의존성에 따른 Phase 분리:

### Phase 0: 기반 확보 (2026-05-11 종료 선언)

- 의도: 비동기화/관측성 Phase 진입 + Phase 1 대규모 스키마 변경 진입 게이트. PR 사이클에서 발견된 결함(#77 E2E HealthModule, #85·#86 redisConfig 영역, #89 production 엔드포인트)을 흡수하는 영역으로 운영. plan-manager 마일스톤 정의 "Phase 1 진입 게이트 + 발견된 결함 정리"가 본 Phase의 운영 정의
- 상태: 종료 (2026-05-11). 8개 이슈 #75/#76/#77/#78/#79/#85/#86/#89 closed. Phase 1 진입 가능
- 해결할 문제: BP5 (비동기화/관측성 선행 기반 부재)
- 대응 기술 문제: TP7
- 근거:
  - Jest 30 등 상위 도구 도입이 Node 버전 선언의 종속
  - 관측성/비동기화 Phase 진입 전에 환경 기준 확보 필요
  - **Phase 1의 대규모 스키마 변경(User Aggregate 재설계)이 synchronize로는 데이터 손실 없이 처리 불가 → migrations 활성화가 Phase 1 선행 조건**
- 감수하는 제약: bcrypt/AES-GCM/의존성 메이저 업그레이드 등 나머지 품질 항목은 Phase 5로 지연
- 범위 외 (인접 Phase 위임):
  - 기능 추가 / 도메인 재설계 (User Aggregate 재설계, 댓글/답글, 커서 페이징) — Phase 1 BP3 / TP3·TP4·TP5 영역
  - 관측성 인프라 신설 (Correlation ID, 메트릭/트레이싱, 대시보드) — Phase 2 BP4 / TP6 영역
  - 비동기 처리 도입 (캐시 / 큐 / Kafka / 알림 비동기 / 집계 비동기 전환) — Phase 3 BP1 / TP1 영역
  - 부하 테스트 측정 환경 / 베이스라인 — Phase 4 BP2 / TP2 영역
  - 보안 표준 강화 (argon2id, AES-GCM) / 메이저 업그레이드 (NestJS 11, TS 6, Jest 30) / RFC 9457 응답 표준 전환 — Phase 5 BP6 / TP8 영역. Phase 0이 활성화한 migrations 인프라는 Phase 5에서 데이터 마이그레이션 도구로 사용되지만, 마이그레이션 작성 자체는 Phase 5
- 전제하는 불확실성 해소: 불확실성 7 (프로덕션 마이그레이션 전략) — migrations 활성화로 해소. 실제 마이그레이션 운용 경험은 Phase 1부터 축적

### Phase 1: 기능 완성 + 도메인 재정비

- 의도: 기능적 구현의 첫 단계. Phase 3 비동기화의 대상이 되는 모든 동기 기능과 도메인 모델을 정비하여, Phase 2 관측 대상 / Phase 3 비동기 전환 대상이 명확히 정의된 상태를 만든다. Phase 1~3은 누적적으로 "기능 완성"을 구성하며, Phase 1은 그 첫 마일스톤(동기 기능 + 도메인 재설계)
- 해결할 문제: BP3
- 대응 기술 문제: TP3 (댓글/답글/중복요청방지) + TP4 (커서 페이징) + TP5 (User 식별자 재설계 — 동일인 식별 기반)
- 근거:
  - 비동기화 실험 대상(알림)이 기능 존재를 전제 (F6 Forces 충돌)
  - 커서 페이징 전환 없이 부하 테스트하면 offset 한계가 다른 튜닝 효과를 가려서 측정 왜곡
  - User 식별자 재설계가 댓글/답글 외래키 설계 선행 조건 — 순서 결합이므로 동일 Phase 내 우선 수행
- 감수하는 제약:
  - 추가 기능(팔로우, 검색 등)은 이번 프로젝트 Out-of-scope. 본인인증 CI는 차선책으로 대체
  - Swagger 문서 품질 대규모 개선은 Phase 5 (NestJS 11 + @nestjs/swagger 11 업그레이드)에서 수행. 현재 v7 기반 대규모 리팩토링은 v11 전환 시 재작업 가능성으로 비효율. Phase 1에서는 신규 엔드포인트/DTO에 기존 수준의 Swagger 데코레이터만 적용 (`@ApiOperation`, `@ApiProperty` 등 현 패턴 계승). 기존 이슈 #45는 Phase 5 배치
- 범위 외 (인접 Phase 위임):
  - 기반 확보 (Node 버전 선언 / 의존성 정리 / migrations 활성화) — Phase 0 BP5 / TP7 영역. Phase 1 진입 게이트로 선행 완료 전제. PR 사이클에서 발견된 기반 결함도 Phase 0에서 흡수
  - 관측성 인프라 (Correlation ID, 메트릭/트레이싱, 대시보드) — Phase 2 BP4 / TP6 영역
  - 비동기 처리 도입 (캐시 / 큐 / Kafka / 알림 비동기 / 집계 비동기 전환) — Phase 3 BP1 / TP1 영역. Phase 1은 동기 구현 완료까지
  - 부하 테스트 측정 — Phase 4 BP2 / TP2 영역
  - 보안 표준 강화 / 메이저 업그레이드 / RFC 9457 / Swagger 대규모 리팩토링 — Phase 5 BP6 / TP8 영역
- 전제하는 불확실성 해소: TP5 내부 설계(email 기반 연동 vs 수동 계정 연결 등)는 Solution 단계에서 대안 트레이드오프 분석 후 확정

### Phase 2: 관측성 가시화

- 의도: 비동기화(Phase 3)와 부하 테스트(Phase 4)의 측정 인프라 선행 확보. 관측 없이 비동기화 도입 시 효과 판정 불가하므로 측정 사이클의 전제 조건. Phase 2는 측정 인프라 구축까지이며, 측정 사이클 자체는 Phase 4
- 해결할 문제: BP4
- 대응 기술 문제: TP6
- 근거:
  - 비동기화(Phase 3)와 부하 테스트(Phase 4)의 측정 인프라 선행 — 관측 없이 비동기화 도입 시 효과 판정 불가
  - 기능 완성(Phase 1)이 선행되어야 관측 대상(엔드포인트/비동기 작업)이 확정됨
- 감수하는 제약: 비동기 작업 관측 세부는 Phase 3에서 보강 (큐/Kafka consumer lag 등)
- 범위 외 (인접 Phase 위임):
  - 기반 확보 — Phase 0 BP5 / TP7 영역
  - 기능 완성 / 도메인 재설계 — Phase 1 BP3 / TP3·TP4·TP5 영역. Phase 1 종료 후 진입하므로 도메인 변경 없음
  - 비동기 처리 도입 (캐시 / 큐 / Kafka / 알림 비동기 / 집계 비동기 전환) — Phase 3 BP1 / TP1 영역. Phase 2는 관측 인프라까지, 비동기 패턴 도입은 Phase 3
  - 부하 테스트 측정 사이클 — Phase 4 BP2 / TP2 영역
  - 보안 표준 강화 / 메이저 업그레이드 / RFC 9457 — Phase 5 BP6 / TP8 영역
- 전제하는 불확실성 해소: 없음

### Phase 3: 비동기화 (캐시/큐/Kafka + 알림 기능 신규)

- 의도: 기능적 구현의 마지막 단계. **Phase 3 종료 시점에서 모든 기능적 구현(동기 기능 + 비동기 패턴 도입 + 알림 기능 + 집계 비동기 전환)이 완료되어, Phase 4가 측정할 시스템 형상이 확정된다.** "Phase 1~3까지의 누적이 곧 기능 완성"이며 Phase 3은 그 마지막 마일스톤. 부하 테스트 직전에 시스템 변동성을 종결하는 기능 마감 단계로서, 이후 Phase 4·5에서는 새 기능 도입을 봉인하고 측정·품질 개선만 수행
- 해결할 문제: BP1
- 대응 기술 문제: TP1
- 근거:
  - 학습 목표의 핵심 Phase
  - 관측성(Phase 2) 확보 후 진입해야 도입 효과를 측정 가능
  - 기능 완성(Phase 1) 후 비동기화 대상 확보 (알림 비동기 구현, 조회수/좋아요 집계 비동기 전환)
  - 이 Phase 내부에서 하위 단계: (i) Redis 캐시 (ii) 작업 큐 (iii) Kafka 이벤트. 각 단계별 Type A + B 블로그 산출
- 감수하는 제약: 완전한 CQRS나 Event Sourcing은 범위 초과 — 이벤트 기반 처리의 기본 패턴까지
- 범위 외 (인접 Phase 위임):
  - 기반 확보 — Phase 0 BP5 / TP7 영역
  - 기능 추가 / 도메인 재설계 — Phase 1 BP3 / TP3·TP4·TP5 영역. Phase 3은 기능 모델 변경 없이 동기 → 비동기 흐름 전환만 (도메인 모델 변경 시 Phase 1 재진입 신호)
  - 관측 인프라 신설 — Phase 2 BP4 / TP6 영역. Phase 3은 큐/Kafka 관측 보강만 추가
  - 부하 테스트 측정 사이클 — Phase 4 BP2 / TP2 영역. Phase 3은 비동기화 구현 완료까지, 측정은 별개 Phase
  - 보안 표준 강화 / 메이저 업그레이드 / RFC 9457 — Phase 5 BP6 / TP8 영역
- 전제하는 불확실성 해소: 4 (첫 블로그 Type A/B 목록) — 이 Phase 도입부 /mcpsi-implementation에서 "Phase 산출 문서" 선언으로 확정

### Phase 4: 부하 테스트 + 튜닝 1차

- 의도: Phase 3까지 확정된 시스템 형상에 대한 베이스라인 측정 사이클. **Phase 5 재측정과의 before/after 비교 기준점을 확보**하는 것이 본 Phase의 핵심 가치. 측정 환경의 안정성 보호가 의무 — 측정 중 코드 변경(기능 추가, 비동기 패턴 추가, 품질 개선)은 비교 무효화 사유
- 해결할 문제: BP2 (1차 사이클)
- 대응 기술 문제: TP2
- 근거:
  - 비동기화 완료(Phase 3) 후 실제 측정 수행 가능
  - 관측성(Phase 2) 인프라를 활용한 병목 탐지
  - "베이스라인 측정 → 튜닝 → 재측정" 학습 목표 핵심 사이클
- 감수하는 제약: 로컬 장비 기준 측정이므로 절대 수치의 대외 재현성 제한. 상대 비교(before/after) 중심 해석
- 범위 외 (인접 Phase 위임):
  - 기반 확보 — Phase 0 BP5 / TP7 영역
  - 기능 / 도메인 변경 — Phase 1 BP3 영역. 측정 환경 안정성 보호 (측정 중 변경 금지)
  - 관측 인프라 신설 — Phase 2 BP4 / TP6 영역. Phase 4는 활용
  - 비동기 패턴 신규 도입 — Phase 3 BP1 / TP1 영역. Phase 4는 도입된 패턴 측정
  - 코드 품질 개선 / 메이저 업그레이드 / RFC 9457 — Phase 5 BP6 / TP8 영역. Phase 4 측정 후 Phase 5에서 변경 (반대 순서로 변경 시 비교 베이스라인 소실)
- 전제하는 불확실성 해소: 3 (부하 테스트 목표 규모 및 수치) — 이 Phase 도입부에서 목표 규모 가정 확정

### Phase 5: 프로덕션 품질 개선 + 재측정 2차

- 의도: **Phase 4 baseline 대비 동일 시나리오 재측정 비교를 위한 프로덕션 품질 개선.** 단순 버전 업데이트가 아닌 "before/after 비교 가능한 학습 사이클"이 본 Phase 핵심. 메이저 업그레이드 / 보안 표준 강화 / 응답 표준 전환은 비교 사이클의 변수이며, 변경 후 동일 시나리오 재측정이 의무. **Phase 0의 기반 확보(Node 버전 / migrations 활성화 / 의존성 정리)는 Phase 5 진입 시점에 이미 선행 완료된 상태가 전제 — Phase 0 영역의 작업을 본 Phase로 이관 금지** (PR #83 사이클 #86 deferred 정정 사례 — 4/29 commit 3e7045b로 Phase 0 통합)
- 해결할 문제: BP6 + BP2 (2차 사이클)
- 대응 기술 문제: TP8
- 근거:
  - Phase 4와 동일 시나리오 부하 테스트를 프로덕션 품질 개선 후 재수행하여 before/after 비교 학습 가치 확보
  - 의존성 메이저 업그레이드(NestJS 11 등)의 breaking change 대응 경험
  - bcrypt/argon2 전환, AES-GCM 전환의 실제 마이그레이션 경험 (migrations 인프라는 Phase 0 선행 완료 전제)
- 감수하는 제약: Phase 4와 Phase 5 사이 코드 변경량이 커서 비교가 복합 요인. 개별 전환의 영향을 분리 측정하려면 추가 반복 필요
- 범위 외 (인접 Phase 위임):
  - 기반 확보 (Node 버전 선언 / 의존성 정리 / migrations 활성화 / 기반 결함 흡수) — Phase 0 BP5 / TP7 영역. Phase 5는 Phase 0 인프라 위에서 데이터 마이그레이션 작성 · 메이저 업그레이드 수행. **Phase 0 미완 항목을 Phase 5로 이관 금지**
  - 기능 추가 / 도메인 재설계 — Phase 1 BP3 영역. 측정 비교의 일관성 보호
  - 관측 인프라 신설 — Phase 2 BP4 / TP6 영역. Phase 5는 활용
  - 새로운 비동기 패턴 도입 — Phase 3 BP1 / TP1 영역. Phase 5는 기존 비동기 흐름을 유지한 채 품질 개선 (응답 포맷·해싱·암호화 등 단면 교체)
  - 측정 환경 신규 구축 — Phase 4 BP2 / TP2 영역. Phase 5는 동일 시나리오 재측정 (시나리오·도구·시각화 동일 유지가 비교 전제)
- 전제하는 불확실성 해소: 8 (의존성 메이저 업그레이드 편입) — 이 Phase 범위로 확정

## 비기능 요구

NFR 활성 여부: 비활성

사유: 정량 NFR 수치(목표 RPS / p99 latency / 동시 사용자 / 데이터 volume) 부재. 본 프로젝트는 1인 학습 프로젝트로 실 사용자 트래픽이 없어 정량 NFR을 사전 확정할 입력이 없다. 부하 테스트 목표 규모는 Phase 4 진입 시점에 가정 기반으로 산정하는 정책(docs/context/unknowns.md "부하 테스트 목표 규모 가정"). Phase 4 진입 시 본 판정을 활성으로 전환하고 problem-nfr 호출하여 QAS 6요소 작성 예정.

context overview.md §사업 목표 및 성공 지표 4의 "수치 목표 미확정 + 가정 확정 후 산정" 정책과 정합.

## 보안/위협 모델링

Threat 활성 여부: 활성

적용 조건 충족:
- 민감 데이터: 인증 정보(password 해시 + salt, refreshToken, JWT 시크릿) + PII(email, nickname, introduce) 보관
- 외부 노출 API: 인터넷 노출 엔드포인트 16개 (인증 4 + 유저 정보 4 + 글 6 + 좋아요 2)
- 외부 신뢰 경계: Google OAuth ID Token 검증 (외부 토큰 → 내부 User Aggregate 변환)

상세는 docs/problem/threat-model.md 참조 (problem-threat 서브 스킬 산출). STRIDE 6범주 + OWASP Top 10 2021 매핑 대상.

## Sources

- docs/context/overview.md (비즈니스 맥락, 이해관계자, 시간 제약, 참고 서비스)
- docs/context/domain.md (UL, BC, 도메인 규칙, 워크플로우)
- docs/context/constraints.md (기술 제약, 의존성 갭, 기존 코드 상태, 보안 경로 후보)
- docs/context/unknowns.md (부하 테스트 목표 규모 / ADMIN 권한 / Domain Event 인벤토리 / 클라우드 인프라 / 의존성 업그레이드 일정)
- docs/meeting-logs/2026-04-24.md (MCPSI 신규 수립)
- docs/meeting-logs/2026-04-29.md (Phase 근거 부정형 경계 추가, Phase 0 운영 정의 역승격, Phase 5 의도 명문화)
- docs/meeting-logs/2026-05-11.md (Phase 0 종료 + Phase 1 진입 + mcpsi 전 단계 재실행)
- 본 프로젝트 PR #83 사이클: 커밋 11270a2 (이관 이슈 #85·#86 plan 통합), 3e7045b (#86 영역 정합 정정 — Phase 5 deferred → Phase 0 통합)
- 기존 코드 분석 (Explore, 2026-04-24) + 코드 직접 확인 (src/user/service/user-auth.service.ts:94 — Google OAuth uid = payload.email 확인)
- Swagger 문서화 품질 점검 (Explore, 2026-04-24): `@ApiParam`·`@ApiQuery` 0% 사용, CLI plugin 비활성, 응답 스키마 혼재
- `@nestjs/swagger` 11.3.0 릴리스 조사 (2026-04-24 WebSearch): NestJS 11 대응으로 Phase 5 업그레이드와 묶임
- 패턴 선정 근거 카테고리: Alexander "Timeless Way of Building" (Forces), Gamma et al. "Design Patterns" Ch.1 (Causes of Redesign), Fowler "Refactoring" + Kerievsky "Refactoring to Patterns" (Smell), Brown et al. "AntiPatterns" (AntiPattern)
- Phase 근거 부정형 경계 방법론: IEEE 29148:2018 §6 Requirements engineering processes / Wiegers & Beatty "Software Requirements" 3e Ch.5
