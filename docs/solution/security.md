# Security

## 소유권 경계

이 파일은 다음 주제의 primary 파일이다:

- 인증(Authentication) — 종단 사용자, 토큰 수명·회전
- 인가(Authorization) — RBAC, 리소스 소유권 판정, IDOR 방어
- 시크릿 저장소 정책
- 데이터 보호 — 비밀번호 해싱, PK 암호화, PII 처리
- Rate Limiting (애플리케이션 계층)
- **API 수신 측 Idempotency-Key 헤더 처리** (§7 상호의존 경계 — 이벤트 수신 측 Idempotency는 async-processing.md §6 primary)
- 침해 대응 알림 (학습 프로젝트 최소화)
- OWASP Top 10 대응 매핑

다른 파일 primary 주제의 포인터:
- 감사 로그 상세 → observability.md
- 환경 변수 일반 관리 → environment.md (미적용 — 로컬 POC, env 파일로 대체. 시크릿 카테고리만 이 파일에서 실체)
- 네트워크 DDoS 계층 → infra-network.md (미적용 — 로컬 POC)
- 이벤트 수신 측 Idempotency → async-processing.md §6
- 비밀번호 해시 / PK 암호문의 테이블 DDL → data-design.md (정책 primary는 이 파일)

## 1. 인증 (Authentication)

### [확정] 종단 사용자 인증 방식 — JWT + argon2id (Phase 5 기준)

**결정**: 자체 JWT(`jsonwebtoken`) 기반 인증 유지. 비밀번호 저장은 **argon2id** (Phase 5 전환) [확정]

**argon2id 파라미터** (OWASP Password Storage Cheat Sheet 2024 최소값):
- `memoryCost: 19456` (19 MiB)
- `timeCost: 2` (iterations)
- `parallelism: 1`
- 해시 결과 포맷: `$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>` (표준 PHC string)

**근거**: TP8 (BP6 프로덕션 품질) + Problem UC-1/UC-2 + OWASP Password Storage Cheat Sheet 2024 1순위 권장 + Argon2는 Password Hashing Competition(2015) 우승 알고리즘으로 GPU/ASIC 저항성 우수(memory-hard)

**기각 대안**:
- **bcrypt** — 오랜 검증 이력이나 GPU 공격 상대적 취약 + PHC 2순위. 학습 가치 관점에서 최신 표준(argon2id) 경험이 우위
- **PBKDF2** — 구식, memory-hard 아님 (NIST만 아직 권장)
- **SHA256 3회 반복 (현 구현)** — Oddball Solution Smell, Reinvent the Wheel AntiPattern (problem.md TP8 근거)

**파급 효과**:
- Phase 5 Lazy Migration: 로그인 성공 시점에 재해싱하여 argon2id로 교체 (async-processing.md §3.4 Expand-and-Contract 패턴 준용)
- 기존 사용자 비밀번호는 재로그인 이전까지 SHA256 해시 유지 — 알고리즘 prefix(`$argon2id$` vs 기존 포맷)로 판별
- `user_auth.password` 컬럼 VARCHAR(1000) 유지 (argon2id 결과 ~97자, 여유 충분)
- 라이브러리: `argon2` (Node.js 네이티브 바인딩) — Phase 5 진입 시 의존성 추가
- data-design.md §user_auth — password 컬럼 스키마는 동일, 값 포맷만 변경

### [확정] 서비스 간 인증 — 해당 없음 (단일 서비스)

**결정**: 서비스 간 인증 설계 해당 없음. 단일 NestJS 애플리케이션 내에서 Kafka Consumer / BullMQ Worker / HTTP API가 같은 프로세스 공간 또는 같은 Docker 네트워크 내에서 동작. 내부 통신 인증은 Phase 3 Kafka/BullMQ 도입 시점에 **로컬 Docker Compose 네트워크 격리**로 대체 [확정]

**근거**: overview.md 배포 모델 "로컬 단독 / POC" + 단일 모노리스 구조 (application-arch.md 모듈 구조) + 클라우드 배포 out-of-scope

**기각 대안**:
- mTLS / Workload Identity — 클라우드 배포 트리거 시점에 도입 (현재 out-of-scope)
- Kafka SASL/SCRAM — 로컬 Docker 네트워크 내부라 과다

**파급 효과**: 클라우드 배포 시 Kafka broker·Redis에 대한 서비스 간 인증 신규 필요 (infra-network Extension 활성화 시점)

### [확정] 토큰 수명 / 회전

**결정**: [확정]
- AccessToken 수명: **1시간** (`JWT_ACCESSTOKEN_EXPIRE_TIME`)
- RefreshToken 수명: **30일** (`JWT_REFRESHTOKEN_EXPIRE_TIME`)
- Refresh Token Rotation: **refresh 시 access + refresh 모두 재발급**, DB 저장값 함께 갱신 (UC-4 Invariant Rotation 원자성)
- Rotation 원자성: `QueryRunner` 기반 명시적 트랜잭션 — data-design.md §트랜잭션/동시성 Rotation 원자성 [확정] 참조
- Refresh Token Reuse Detection: **Phase 2 관측성 도입 후 검토** — 현 구현은 "DB 저장값 불일치 시 401" 기본 방어. Reuse 탐지(이전 토큰 재사용 시 모든 세션 무효화)는 학습 프로젝트 후속 과제로 기록

**근거**: problem.md UC-4 Main Success Scenario + Invariant "Rotation 원자성" + docs/tech-notes/token-validation-strategies.md Phase 0 Type A 블로그의 Refresh Token 서버측 검증 방식 + OWASP JWT Cheat Sheet "Short-lived access tokens + rotating refresh tokens"

**기각 대안**:
- AccessToken 단일 (장기 수명) — 즉시 무효화 불가, 탈취 시 최대 수명까지 노출 (docs/tech-notes/token-validation-strategies.md "Access Token만 사용하는 표준 방식의 한계" 근거)
- Access 5분 / Refresh 7일 (더 짧은 수명) — 학습 프로젝트에서 네트워크 호출 증가 대비 보안 이득 미미. 현재 1h/30d 조합 유지

### [확정] MFA — 해당 없음

**결정**: MFA(다중 인증) 미도입 [확정]

**근거**: context.md [이해관계자] 단일 개발자 학습 프로젝트 + 규제 요구 없음 + OWASP ASVS Level 1 요구 수준 초과. Phase 5 범위에도 없음

**기각 대안**: TOTP 기반 MFA — 학습 가치는 있으나 블로그 서비스 도메인에 필수 아님. 후속 학습 과제

## 2. 인가 (Authorization)

### [확정] 인가 모델 — RBAC (단일 계층)

**결정**: Role-Based Access Control 모델 유지. `UserRole` enum(`USER`, `ADMIN`) 2값. 현 `@Roles()` 데코레이터 구조 유지. ADMIN 차등 권한 정의는 out-of-scope (problem.md Out-of-scope 트리거 조건) [확정]

**근거**: problem.md Out-of-scope "ADMIN vs USER 역할 차등 권한 정의" + 현 구현 기존 유지 원칙 + NIST SP 800-162 RBAC 정의

**기각 대안**:
- ABAC (Attribute-Based) — 단일 개발자/단순 블로그 도메인에서 과다
- RLS (Row Level Security, DB 엔진 강제) — MySQL InnoDB는 native RLS 미지원(PostgreSQL/Supabase 한정). 애플리케이션 레벨 소유권 확인으로 대체
- ReBAC (Relationship-Based) — 복잡 도메인용, 블로그에 과다

**파급 효과**: ADMIN 차등 권한이 필요해지는 시점(관리자 기능 필요 트리거) Decision Table 적용 후보 발생 — problem.md Out-of-scope 항목 참조

### [확정] 리소스 소유권 판정 (IDOR 방어)

**결정**: 모든 Write API (수정/삭제)에서 리소스 소유권 확인. `resource.userId == 인증된 userId` 검증을 Service 레이어 또는 Repository 레이어에서 수행. 실패 시 `403 Forbidden` 또는 `404 Not Found` (정보 노출 방지 목적) [확정]

**대상 엔드포인트 (Phase 1 리팩토링 완료 시점)**:
- `PATCH /posts/:postId` / `DELETE /posts/:postId` — `Post.userId` 검증
- `PATCH /posts/comments/:commentId` / `DELETE /posts/comments/:commentId` — `Comment.userId` 검증 (Phase 1 신규)
- `PATCH /posts/comments/:commentId/replies/:replyId` / `DELETE ...` — `Reply.userId` 검증 (Phase 1 신규)
- `DELETE /posts/:postId/likes` — `PostLike.userId` 검증
- `PATCH /users/info` / `DELETE /users/info` — 인증된 userId로 자동 제한

**IDOR 방어 계층 구조**:
1. **PK 암호화** (AES-ECB → AES-GCM, §4 데이터 보호 참조) — 순차 ID 추측 공격 차단
2. **DecryptPrimaryKeyPipe** — 복호화 실패 시 400, 숫자 아님 400
3. **Service 레이어 소유권 확인** — `resource.userId !== authUserId` 시 403/404

**근거**: OWASP A01:2021 Broken Access Control + OWASP IDOR Cheat Sheet + problem.md Phase 1 TP5 User 식별자 재설계로 Post/PostLike/Comment/Reply의 외래키가 `userId`로 통일됨(application-arch.md §3방향 리팩토링)

**기각 대안**:
- 소유권 확인 컨트롤러 레벨에서만 수행 — Service 재사용 시 우회 가능. **Service 레이어 강제**가 방어선 일관성 보장
- 403 vs 404 반환 일관성 — 존재하는 리소스의 권한 거부는 403, 존재 여부 자체를 숨기려면 404. **학습 프로젝트 간결성으로 403 기본, 민감 리소스는 404** [가이드]

**파급 효과**:
- Phase 1 User Aggregate 재설계 후 모든 Write 엔드포인트 재검증 필수 — E2E 테스트로 권한 테스트 케이스 추가
- 관측성 Phase 2: 권한 거부(403) 급증 시 침해 의심 시그널 (§7 침해 대응 참조)

### [가이드] 권한 승격 방지 — 수평 권한 승격(IDOR)

**결정**: 위 "리소스 소유권 판정"으로 방어. 수직 권한 승격(USER → ADMIN)은 ADMIN 차등 권한이 정의되는 시점(out-of-scope 트리거)에 재검토 [가이드]

**근거**: OWASP A01 + 현 RBAC 모델의 ADMIN 차등 미정의 상태

## 3. 시크릿 관리

### [확정] 시크릿 저장소 — env 파일 + GitHub Actions Secrets

**결정**: [확정]
- **로컬 개발**: `env/.development.env`, `env/.test.env` 파일. Joi 스키마로 검증
- **CI/CD**: GitHub Actions Secrets (PROJECT_TOKEN 등 이미 존재)
- **프로덕션**: 클라우드 배포 out-of-scope. 배포 시 AWS Secrets Manager / Vault / Doppler 등 재검토 (트리거 조건)

**근거**: context.md [기술 스택 제약] 기존 env 파일 + Joi 검증 구조 유지 + context.md [인프라/예산/인력 제약] 로컬 Docker Compose만 전제 + Vault/Secrets Manager 운영 복잡도가 학습 프로젝트 규모 대비 과다

**기각 대안**:
- HashiCorp Vault — 운영 복잡도 과다, 로컬 환경에서 학습 가치 대비 비용 높음
- AWS Secrets Manager — 클라우드 의존, out-of-scope
- Doppler — SaaS 무료 tier 있으나 외부 의존 추가
- OS 환경변수 직접 주입 — CI 연동 어려움, `.env.example` 기반 개발자 간 동기화 어려움

### [확정] 시크릿 카테고리 및 저장 위치

**결정**: [확정]

| 카테고리 | 환경변수 | 회전 주기 |
|---|---|---|
| DB 접속 | `DB_PASSWORD` | 학습 프로젝트 수동. 프로덕션 트리거 시 자동화 |
| Redis 접속 | `REDIS_PASSWORD` | 동일 |
| JWT 서명 키 | `JWT_SECRET` | 수동. 회전 시 기존 토큰 전체 무효화 감수 |
| PK 암호화 키 | `PK_SECRET_KEY` (16자 고정) | Phase 5 AES-GCM 전환 시 신규 키 발급 + Expand-and-Contract로 기존 암호문 점진 재암호화 |
| OAuth Client | `GOOGLE_CLIENT_ID` | Google Console에서 관리 |
| Slack Webhook (Page) | `SLACK_WEBHOOK_PAGE_URL` | 수동 회전 (Slack workspace 관리 콘솔). Phase 2 도입 — observability.md §4.4 |
| Slack Webhook (Ticket) | `SLACK_WEBHOOK_TICKET_URL` | 동일 |
| Slack Webhook (Security) | `SLACK_WEBHOOK_SECURITY_URL` | 동일. 침해 대응 알림(§7) 시그널 라우팅 전용 |

**근거**: context.md [보안 관련 경로 후보] + Joi 환경변수 검증 스키마(`validationEnv.ts`) + observability.md §4.4 Slack 알림 채널 [확정] (Phase 2 진입 시 validationEnv.ts에 3종 추가)

### [가이드] 시크릿 노출 방지 — gitleaks pre-commit 훅

**결정**: Phase 0 편입 — Husky pre-commit 훅에 **gitleaks** 추가 [가이드]

**근거**: OWASP A03/A08 + GitHub Secret Scanning 업계 표준 + 학습 프로젝트에서도 커밋 순간 검출이 방어선 효율적

**구현**: `.husky/pre-commit`에 `npx gitleaks protect --staged --redact` 추가. 로그/에러 메시지에서 시크릿 금지는 NestJS Global Exception Filter가 처리 (기존 구조)

**파급 효과**: Core 재동기화 요청 — application-arch.md Phase 0 로드맵 행에 "gitleaks pre-commit 훅 추가" 보강 필요

## 4. 데이터 보호

### [확정] 전송 중 암호화

**결정**: [확정]
- 로컬 개발/테스트 환경: HTTPS 미강제 (Docker Compose 내 localhost 통신)
- 프로덕션 배포 시점(out-of-scope 트리거): TLS 1.2+ 강제, 인증서는 Let's Encrypt 또는 CSP 제공 관리형 인증서 (infra-network Extension 활성화 시점)

**근거**: context.md [배포 모델] 로컬 POC + problem.md Out-of-scope 클라우드 배포

### [확정] 비밀번호 저장 — argon2id (Phase 5)

상세: §1 인증 §종단 사용자 인증 방식 참조. 중복 기술 금지.

### [확정] PK 암호화 — AES-GCM (Phase 5 전환)

**결정**: 현재 AES-ECB (문자 `crypto-js` 기본) → **Phase 5에 AES-256-GCM 전환** [확정]

**AES-GCM 파라미터**:
- 키 길이: 256bit (현 `PK_SECRET_KEY` 16자 = 128bit → Phase 5에 32자 키로 확장)
- IV: 12바이트, per-encryption 랜덤 생성 (`crypto.randomBytes(12)`)
- Authentication Tag: 16바이트
- 암호문 포맷: `base64url(iv || ciphertext || tag)` — 단일 URL-safe 문자열

**근거**:
- TP8 Phase 5 확정 범위 + problem.md §보안 관련 경로 후보 "AES-ECB는 일반적으로 권장되지 않음"
- OWASP Cryptographic Storage Cheat Sheet — GCM 또는 CBC-HMAC 권장. GCM이 인증 암호화(Authenticated Encryption) 내장으로 우위
- NIST SP 800-38D GCM 사양

**기각 대안**:
- **AES-CBC** — 인증 태그 별도 HMAC 필요. 복잡도 증가. GCM이 Authenticated Encryption 단일 API로 단순
- **XChaCha20-Poly1305** — 성능 우위이나 Node.js `crypto` 표준 미포함(sodium 라이브러리 추가 필요). AES-GCM은 표준 Node crypto 지원
- **AES-ECB 유지** — Oddball Solution Smell, 패턴 노출 취약

**파급 효과**:
- Phase 5 Expand-and-Contract: 응답 생성 시 신규 포맷으로 암호화, 요청 복호화 시 포맷 prefix 판별(`base64url` decode 후 길이)로 구버전/신버전 동시 지원. 모든 응답이 신버전으로 전환된 후 구버전 복호화 로직 제거
- `DecryptPrimaryKeyPipe` 수정: 두 포맷 지원 (Phase 5 과도기)
- `EncryptPrimaryKeyInterceptor`: 신규 포맷만 생성
- `PK_SECRET_KEY` 환경변수 교체 (Phase 5 진입 시). 기존 키는 구버전 복호화 전용으로 `PK_SECRET_KEY_LEGACY`로 보존 → drain 완료 후 제거
- data-design.md Phase 5 섹션의 PK 재암호화 전략과 정합

### [확정] PII 식별 및 처리

**결정**: 다음 필드를 PII로 분류 [확정]

| 필드 | 성격 | 보호 조치 |
|---|---|---|
| `user_auth.login_id` | 준식별자 (일반 가입) | 평문 저장, 외부 API 응답에 포함 금지 (본인 조회만) |
| `user_auth.password` | 매우 민감 | argon2id 해시 저장 (Phase 5), 로그/응답 절대 노출 금지 |
| `user_auth.refresh_token` | 매우 민감 | **Phase 5 검토**: 현재 평문 저장 → 해시 저장으로 전환 [가이드] |
| `user_auth_provider.provider_subject` | 외부 IdP 고유 ID (준식별자) | 평문 저장, 외부 응답 노출 금지 |
| `user_auth_provider.email` | 직접 식별자 | 평문 저장, 본인/소유 리소스 응답에만 포함 |
| `user_info.nickname` | 공개 프로필 | 공개 노출 허용 (사용자가 공개 의사 표명) |
| `user_info.introduce` | 공개 프로필 | 공개 노출 허용 |
| Correlation ID (X-Correlation-Id) | **PII 아님** | 비즈니스 식별자(요청 단위 UUID v4). 응답 헤더 echo 허용 — observability.md §1.4 정합. 클라이언트가 동일 ID로 후속 추적/디버깅 요청 가능 |

**근거**: OWASP A02 Cryptographic Failures + OWASP PII Cheat Sheet + 개인정보보호법 민감정보 정의(적용 대상은 아니나 가이드라인 참조) + Correlation ID는 사용자 식별과 무관한 요청 단위 임의 식별자(RFC 4122 UUID v4)

**파급 효과**:
- 로그에서 password / refresh_token 자동 마스킹 — observability.md Winston 로그 포맷 확장 시 `password`, `refreshToken`, `credentialToken` 키 블랙리스트 마스킹 로직 추가 필요
- E2E 테스트에서 이 필드가 응답에 노출되지 않음을 검증 (Phase 1 리팩토링 시 테스트 강화)

### [가이드] refresh_token 해시 저장 — Phase 5 검토

**결정**: 현재 `user_auth.refresh_token`은 DB에 평문 저장. Phase 5에 **SHA-256 해시 저장으로 전환 검토** [가이드]

**근거**: OWASP JWT Cheat Sheet "Store only hashes of refresh tokens in DB" + DB 유출 시 세션 탈취 방어. 다만 해시 전환 시 검증 로직(수신한 refresh token을 해시 후 DB 값과 비교)으로 변경 필요

**보류 사유**: Phase 5 전환 항목 과다 시 제외 가능. 학습 가치는 명확

### [확정] 데이터 보관/파기

**결정**: [확정]
- 사용자 삭제(`DELETE /users/info`): CASCADE로 전체 관련 데이터(user_auth / user_info / user_auth_provider / post / comment / reply / post_like / notification) 동시 삭제
- Soft Delete: **미적용** — 학습 프로젝트 단순성
- GDPR right to erasure / 개인정보보호법 파기 요구: 대상 아님 (적용 국가·규제 비해당)

**근거**: application-arch.md §Aggregate CASCADE 정책 + data-design.md 관계 표 + 학습 프로젝트 단순성 예외

**기각 대안**: Soft Delete — 학습 가치 있으나 모든 쿼리에 `WHERE deleted_at IS NULL` 추가 필요. 현 단계 우선순위 낮음

## 5. Rate Limiting

### [확정] 라이브러리 및 계층 — @nestjs/throttler (애플리케이션 계층)

**결정**: **`@nestjs/throttler` + Redis storage driver** 채택. 애플리케이션 계층 구현 [확정]

**근거**: NestJS 공식 Throttler 모듈 + Guard 통합 친화 + Redis storage로 다중 인스턴스 확장 가능 (Phase 3 Kafka 도입 시 consumer 다중 인스턴스 시나리오 대비)

**기각 대안**:
- `express-rate-limit` — NestJS Guard 통합 불편
- Custom Interceptor — NestJS 공식 솔루션 있는데 재구현 불필요
- 네트워크 DDoS 계층 (CloudFront WAF 등) — 로컬 POC 환경에 부적합, infra-network Extension 트리거 시점에 보완

### [확정] 경로별 제한 정책 (Phase 1 도입)

**결정**: [확정]

| 엔드포인트 | 제한 단위 | 제한값 | 초과 시 응답 |
|---|---|---|---|
| `POST /users/auth/login` | IP | 분당 10회 | 429 + Retry-After |
| `POST /users/auth/join` | IP | 시간당 5회 | 429 + Retry-After |
| `POST /users/auth/oauth` | IP | 분당 30회 | 429 + Retry-After |
| `POST /users/auth/refresh` | user_id (인증된 경우 + fallback IP) | 분당 10회 | 429 + Retry-After |
| Write API (`POST/PATCH/DELETE /posts...`, `/users/info`) | user_id | 분당 60회 | 429 + Retry-After |
| 읽기 API (`GET /posts...`, `/users/info`) | IP | 분당 200회 | 429 + Retry-After |

**근거**: OWASP Authentication Cheat Sheet "Throttling" + 학습 프로젝트 기본값(프로덕션 시 실측 기반 조정 필요)

**기각 대안**:
- 모든 API에 동일 제한 — 로그인 brute force와 일반 조회의 위험 수준이 다른데 일률 적용은 비효율
- 경로별 제한을 NestJS `@Throttle()` 데코레이터로만 관리 — ThrottlerStorage 기반 중앙 설정이 운영 가시성 우위

**파급 효과**:
- Phase 1 진입 시 `@nestjs/throttler` 의존성 추가 + `app.module.ts`에 ThrottlerGuard 전역 등록
- 읽기 API 분당 200회 상한은 Phase 4 부하 테스트 시점에 실측 기반 조정 [가이드]
- 429 응답 시 로그 기록 — §7 침해 대응 감지 시그널로 사용

### [확정] 429 초과 시 처리

**결정**: HTTP 429 + `Retry-After` 헤더 + 로깅 (Warning 레벨). 자동 IP 차단은 미적용 [확정]

**근거**: RFC 6585 Section 4 + RFC 9110 Section 15.5.2 Retry-After + 학습 프로젝트 UX 우선 (자동 차단은 오탐 리스크)

## 6. 백업/복구 (DR)

### [확정] DR 범위 — 학습 프로젝트 최소화

**결정**: [확정]
- **RPO/RTO**: 명시적 목표 없음 (프로덕션 배포 out-of-scope)
- **백업 주기**: 개발 중 수동 `mysqldump` 또는 Docker volume snapshot
- **복구 훈련**: Phase 5 진입 시 1회 복구 훈련 수행 — 학습 목적 + Type B 블로그 글감. migrations 인프라가 Phase 0에서 활성화된 상태를 전제로 복구 절차에 `migration:run` 포함
- **백업 저장 위치**: 로컬 개발 장비 (클라우드 동기화는 out-of-scope)

**근거**: context.md [배포 모델] 로컬 POC + problem.md Out-of-scope 클라우드 배포 + 학습 가치는 "복구 절차 경험" 자체에 있음 + AWS Well-Architected Reliability Pillar "Test recovery procedures" (학습 프로젝트 적용 수준 — 1회 훈련)

**기각 대안**:
- (1) RDS Automated Backup + PITR (Point-in-Time Recovery) — 클라우드 배포 트리거 시점에 재수립 (out-of-scope 트리거 조건)
- (2) RPO/RTO 수치 명시적 합의 (예: RPO 1시간 / RTO 4시간) — 학습 프로젝트 단일 개발자 + 비프로덕션이라 SLA 합의 대상 부재. 수치 합의는 트리거 조건 시
- (3) 자동 백업 스케줄링 (cron + S3 업로드) — 클라우드 의존, out-of-scope

**파급 효과**:
- Phase 5 진입 시점에 복구 훈련 시나리오 명세 (Type B 블로그 글감으로 산출). 시나리오 예: "MySQL 컨테이너 데이터 디렉토리 손상 → mysqldump 백업본 + migration:run 복구 → 데이터 정합성 검증"
- migrations 인프라 의존 — Phase 0 TP7 선행 완료 필수
- 클라우드 배포 트리거 충족 시 본 결정 supersede (RDS Automated Backup + PITR + RPO/RTO 명시적 SLA 등으로 재수립). 트리거 조건은 problem.md 알려진 불확실성 6 (예산 확보)

## 7. 침해 대응 알림

### [가이드] 감지 시그널 — 학습 프로젝트 최소화

**결정**: 다음 시그널을 observability Extension의 알림 채널로 라우팅 [가이드]

| 시그널 | 임계값 | 대응 |
|---|---|---|
| 로그인 실패 연속 | 같은 loginId 5회 / 15분 | 자동 계정 잠금 (§아래 항목 참조) |
| 429 Rate Limit 초과 | 같은 IP 분당 10회 이상 | 로그 기록, 관측성 Alert (Phase 2) |
| 권한 거부(403) 급증 | 같은 user_id 시간당 20회 이상 | 관측성 Alert (Phase 2) |
| refresh token DB 불일치 | 단일 발생 | Warning 로그 (탈취 의심 시그널) |

알림 채널 구체 구성(Slack/이메일/로그)은 **observability.md §알림 채널** 참조 (주제 소유권 §6 매트릭스)

**근거**: OWASP Logging Cheat Sheet + Authentication Cheat Sheet "Throttling unsuccessful attempts" + 학습 프로젝트 최소화 원칙

### [가이드] 로그인 실패 카운트 / 계정 잠금

**결정**: [가이드]
- **대상**: `POST /users/auth/login`
- **카운트 저장**: Redis key `login_fail:{loginId}` TTL 15분. 로그인 실패 시 INCR, 성공 시 DEL
- **잠금 조건**: 카운트 ≥ 5
- **잠금 응답**: 401 (잠금 사실 숨김, 계정 열거 방지) + Retry-After 15분
- **해제**: TTL 만료 (15분 후 자동) 또는 관리자 수동(ADMIN 차등 권한이 정의되는 시점에 도입)

**근거**: OWASP Authentication Cheat Sheet + Credential Stuffing 방어 표준

**기각 사유 [가이드] 분류**: 정확한 잠금 임계값은 UX 트레이드오프 있음. 학습 프로젝트에서는 구현 후 실측 기반 조정 가능

**파급 효과**:
- Phase 1 도입. user-auth.service의 login 메소드에 Redis 카운터 로직 추가
- data-design.md: Redis 외부 저장소 — DDL 해당 없음. 키 구조(`login_fail:{loginId}` 문자열 카운터, TTL 15분) 문서화
- Core 재동기화 요청 — data-design.md §Phase 1에 Redis 키 구조 문서 항목 추가 (외부 저장소 정책 primary는 security.md)

### [확정] 포렌식 로그 보존

**결정**: 로그 보존 기간 최소 30일 [확정]

**근거**: OWASP Logging Cheat Sheet "Retention" 최소 권장 + 침해 발생 시 역추적 기간 + 학습 프로젝트 로컬 저장 용량 고려

**상세**: observability.md §로그 보존 참조 (감사 로그 정책 primary)

## 8. API 수신 측 Idempotency-Key 헤더 (§7 상호의존 경계)

**경계**: 이 섹션은 **API 수신 측(HTTP 클라이언트 재시도 방어)**의 중복 처리 방지. 이벤트 수신 측(Kafka/BullMQ consumer 중복 방지)은 async-processing.md §6 primary.

### [확정] Idempotency-Key 헤더 규약

**결정**: 클라이언트가 `Idempotency-Key` 헤더에 UUID v4 생성하여 전달. 서버는 해당 키를 Redis에 저장하여 같은 키의 중복 요청을 감지 [확정]

**헤더 형식**: `Idempotency-Key: <UUID v4>` — 표준 형식만 허용 (RFC 4122)

**대상 엔드포인트 (Phase 1 도입)**:
- **필수**: 모든 Write API (POST/PATCH/DELETE) — 특히 `/posts/:postId/likes`, `/posts`, `/posts/comments`, `/posts/comments/:commentId/replies`
- **선택**: 읽기 API — 미적용 (GET은 idempotent이어야 하며 클라이언트 재시도 방어 불필요)

**근거**: IETF draft-ietf-httpapi-idempotency-key-header + Stripe/GitHub API 업계 표준 + Helland "Idempotence is Not a Medical Condition"

**기각 대안**:
- 서버 생성 트랜잭션 ID — 클라이언트 재시도 시 새 ID 발급되어 중복 방지 실패
- DB UNIQUE 제약만 — 상태 변경 연산(좋아요 취소 후 재좋아요 등) 처리 모호. Idempotency-Key가 애플리케이션 의미 수준 보장

### [확정] 저장소 — Redis

**결정**: Redis 외부 저장소 사용. 기존 스택 활용 [확정]

**키 구조**:
- 키: `idempotency:{user_id}:{idempotency_key}`
- 값: JSON `{ "statusCode": 201, "responseBody": "<base64 or raw>", "method": "POST", "path": "/posts/42/likes", "processedAt": "ISO8601" }`
- TTL: **24시간**

**근거**:
- context.md [기술 스택 제약] Redis 기존 구성 활용 + 외부 저장소이므로 DDL 개념 없음 (§6.1 실체 기술 레이어 규칙)
- TTL 24시간: Stripe 권장 24h 기준 + 클라이언트 재시도는 통상 수 분 내 완료되므로 24h 여유 충분

**기각 대안**:
- MySQL 테이블 저장 — Audit 목적이라면 의미 있으나 학습 프로젝트에서 Redis TTL이 운영 단순성 우위
- in-memory (NestJS Service) 캐시 — 다중 인스턴스 확장 불가

### [확정] 중복 감지 시 동작

**결정**: [확정]

1. 요청 수신 → `user_id + idempotency_key` 조합으로 Redis GET
2. 값 존재 + 완료 상태 → **원본 응답 재반환** (status, body 복원)
3. 값 존재 + 진행 중(pending) 상태 → **409 Conflict** + `Retry-After: 5` (클라이언트에게 재시도 요청)
4. 값 없음 → 새 요청 처리 시작 — Redis에 pending 상태로 저장(SETNX) → 처리 후 완료 응답으로 UPDATE

**근거**: Stripe Idempotency API + IETF draft "Replaying Same Request Results in Same Response"

**기각 대안**:
- 단순 SETNX + 없으면 처리 (완료/진행중 구분 없음) — 동시 요청 시 한쪽이 실패하지만 응답 일관성 저하
- 중복 시 409 단순 반환(원본 응답 복원 없음) — 클라이언트 네트워크 재시도 시나리오에서 UX 저하

### [확정] 관측성 통합

**결정**: Idempotency 중복 감지 시 Warning 로그 + 카운터 메트릭. 관측성 Phase에서 대시보드 표시 [확정]

**근거**: 중복 감지 급증은 클라이언트 오작동 또는 공격 시그널

## 9. OWASP Top 10 2021 대응 매핑

| 카테고리 | 대응 섹션 | 현 상태 / Phase 계획 |
|---|---|---|
| **A01 Broken Access Control** | §2 인가 | RBAC + 소유권 확인(Phase 1 리팩토링) + PK 암호화(Phase 5 AES-GCM 전환) |
| **A02 Cryptographic Failures** | §1 인증 + §4 데이터 보호 | argon2id 전환 + AES-GCM 전환 (Phase 5). 현 SHA256 3회 반복 / AES-ECB은 Smell + AntiPattern으로 식별됨 |
| **A03 Injection** | [가이드] | TypeORM 파라미터 바인딩 기본 + class-validator 입력 검증(@IsString/@IsEmail 등 기존 DTO 구조 유지). SQL Injection 방어 충분. 새 엔드포인트도 동일 패턴 [가이드] |
| **A04 Insecure Design** | application-arch.md | Aggregate Invariant 강제 (Vernon Rule 1) + UC Extensions에 Failed End Condition 명시 — problem.md §Use Cases 참조 |
| **A05 Security Misconfiguration** | [가이드] | CORS `origin: true` 학습 환경 유지. 프로덕션 배포 트리거 시 allowlist 전환. Swagger UI는 Phase 5까지 모든 환경 노출(학습 목적) — 프로덕션 시점에 환경별 노출 제어 추가 [가이드] |
| **A06 Vulnerable Components** | [가이드] | Phase 5 의존성 메이저 업그레이드 시 npm audit + Dependabot 활성화 검토 [가이드] |
| **A07 Identification and Authentication Failures** | §1 인증 | JWT 이중 검증 + Rotation(기존) + 로그인 실패 카운트(Phase 1 도입) + argon2id(Phase 5) |
| **A08 Software and Data Integrity** | [가이드] | Phase 5 진입 시 SBOM 생성 검토(npm ls 기반 산출) [가이드] |
| **A09 Logging and Monitoring Failures** | → observability.md | 감사 로그 포맷 / Correlation ID 전파 / 로그 보존은 observability Extension 소관 |
| **A10 SSRF** | [확정] | 외부 호출은 Google OAuth 1건. `google-auth-library`가 Google 공식 엔드포인트 하드코딩. 추가 외부 호출 발생 시 allowlist 도메인 검증 필수 [확정] |

## 외부 서비스 회복력 (checklist-common §외부 서비스 회복력)

### [확정] Google OAuth 호출 회복력

**결정**: [확정]
- **Timeout**: Connect 3초 / Read 10초 (`google-auth-library` OAuth2Client 기본값 사용)
- **Retry**: 1회 재시도 (jitter 500ms) — 실패 시 `AuthInvalidOauthTokenException`
- **Circuit Breaker**: 미적용 — 학습 프로젝트 규모 + 호출 빈도(로그인 시에만) 낮음
- **Fallback**: 없음 — OAuth 불가 시 일반 가입 경로 사용 권장 (사용자 UX로 안내)

**근거**: Nygard "Release It!" Stability Patterns + checklist-common §외부 서비스 회복력 + google-auth-library 공식 기본값

**기각 대안**: Circuit Breaker 도입 — 학습 가치는 있으나 호출 빈도 낮아 Circuit 상태 관찰 기회 드묾. Phase 3 async Extension의 Kafka/BullMQ 외부 의존에서 Circuit Breaker 학습 대안 있음

## 동시성 전략 (checklist-common)

§2.2 리소스 소유권 판정 + §1 토큰 수명·회전 의 Rotation 원자성 + data-design.md §트랜잭션/동시성 참조. 중복 기술 금지.

## Graceful Shutdown

async-processing.md §8.5 Graceful Shutdown 참조. security 관점 보강:

- SIGTERM 시 **진행 중 Idempotency Key 처리 완료 대기** — Redis의 pending 상태 key는 완료 응답으로 전환하거나 30초 타임아웃 시 오류 응답 저장(후속 재시도가 중복으로 감지되지 않도록)
- 로그인 실패 카운터 / Rate Limit 카운터: Redis 이므로 프로세스 재시작 무관 유지

## Sources

- docs/context.md
- docs/problem.md (BP3, BP6, TP3, TP5, TP8, UC-1~7, Invariant 12, §보안 관련 경로 후보)
- docs/solution/overview.md, application-arch.md, data-design.md, async-processing.md
- docs/meeting-logs/2026-04-24.md
- ~/.claude/skills/security-standards/SKILL.md (CWE/OWASP 매핑)
- ~/.claude/skills/mcpsi-solution/references/checklist-common.md (외부 서비스 회복력 / Graceful Shutdown / 동시성)
- 방법론 근거:
  - OWASP Top 10 2021
  - OWASP Password Storage Cheat Sheet 2024 (argon2id)
  - OWASP Authentication Cheat Sheet
  - OWASP JWT Cheat Sheet
  - OWASP IDOR Cheat Sheet
  - OWASP Cryptographic Storage Cheat Sheet
  - OWASP Logging Cheat Sheet
  - RFC 4122 (UUID), RFC 6585 (429), RFC 9110 (HTTP)
  - NIST SP 800-38D (AES-GCM)
  - NIST SP 800-162 (RBAC)
  - Password Hashing Competition (2015) Argon2
  - Helland "Idempotence is Not a Medical Condition" (ACM Queue 2012)
  - IETF draft-ietf-httpapi-idempotency-key-header
  - Nygard "Release It!" 2nd ed. Stability Patterns
