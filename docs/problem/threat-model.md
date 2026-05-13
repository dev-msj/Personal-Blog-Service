# Problem — Threat Model

자산 → 공격면 → STRIDE 위협 → 완화 후보 → OWASP Top 10 2021 매핑. solution-security 입력 계약(STRIDE × OWASP 이중 입력)을 형성한다.

문서 위상: Problem 단계 산출. 완화 후보는 후보 수준이며, 구체적 보안 컨트롤(인증/인가/시크릿/Rate Limiting/암호화 알고리즘) 확정은 docs/solution/security.md 책임. nfr-qas.md 비활성(problem/overview.md §비기능 요구)이므로 본 문서 §QAS 정합 섹션은 비활성 사유 명기.

방법론 근거: Microsoft SDL Threat Modeling (Kohnfelder & Garg 1999), Shostack "Threat Modeling: Designing for Security" (2014) STRIDE-per-element, OWASP Top 10 2021.

## 자산 (Assets)

데이터 분류 등급 기준: 기밀(외부 노출 시 회복 불가 손실) / 내부(서비스 운영 보호 대상) / 공개(공개 의도 데이터).

### ASSET-1: 사용자 인증 자격 [기밀]
- 구성: password 해시(SHA256 3회 반복), salt, refreshToken (UserAuthEntity)
- 보호 가치: Confidentiality + Authenticity
- 분류: 기밀
- 위치: MySQL `USER_AUTH` 테이블
- 비고: password 해싱 알고리즘은 Phase 5 argon2id 전환 예정 (TP8)

### ASSET-2: 세션 토큰 [기밀]
- 구성: accessToken (Authorization: Bearer), refreshToken (HTTPOnly 쿠키 + DB 저장)
- 보호 가치: Confidentiality + Authenticity + Integrity
- 분류: 기밀
- 위치: 클라이언트(쿠키) + MySQL `USER_AUTH.refreshToken`
- 비고: Token Rotation 적용 (refresh 호출 시 access+refresh 모두 재발급)

### ASSET-3: 시크릿/암호화 키 [기밀]
- 구성: JWT_SECRET, PK_SECRET_KEY(AES-ECB 16자), GOOGLE_CLIENT_ID, DB_PASSWORD, REDIS_PASSWORD
- 보호 가치: Confidentiality
- 분류: 기밀
- 위치: 환경변수 파일(env/.development.env, env/.test.env)
- 비고: gitleaks pre-commit 훅으로 staged 유출 차단 (Phase 0 #78). PK_SECRET_KEY는 Phase 5에 32자 AES-256으로 확장 예정

### ASSET-4: 사용자 식별 PII [기밀]
- 구성: uid(현 구현에서 OAuth 사용자는 email), nickname, introduce, Google OAuth payload(email/sub)
- 보호 가치: Confidentiality + Integrity
- 분류: 기밀 (개인정보보호법 적용)
- 위치: MySQL `USER_AUTH.uid`, `USER_INFO`
- 비고: 현 구현은 OAuth uid=email로 PII가 외래키 전파 경로(PostEntity.postUid)에 직접 노출. Phase 1 TP5 재설계로 userId(BIGINT) 분리 예정

### ASSET-5: 사용자 작성 콘텐츠 [내부]
- 구성: Post(title, contents), PostLike, (Phase 1) Comment, Reply
- 보호 가치: Integrity + Authenticity (작성자 무결성)
- 분류: 내부 (의도된 공개이지만 작성자 신원 무결성은 보호 대상)
- 위치: MySQL `POST`, `POST_LIKE`
- 비고: 작성자 본인만 수정/삭제 (postUid == authUid)

### ASSET-6: API Primary Key [내부]
- 구성: postId(AUTO_INCREMENT) → AES-ECB 암호문으로 API 경계 노출
- 보호 가치: Confidentiality (정수 순서 노출 방지)
- 분류: 내부
- 위치: API 응답 본문 / 요청 path param
- 비고: AES-ECB는 동일 평문 → 동일 암호문 패턴 노출 취약. Phase 5 AES-GCM 전환 예정 (TP8)

### ASSET-7: 시스템 가용성 [내부]
- 구성: API 응답 성공률, DB/Redis 연결, 인증 처리 가용성
- 보호 가치: Availability
- 분류: 내부
- 위치: 런타임 전반
- 비고: NFR 비활성(목표 RPS/p99 미확정)이므로 정량 임계 없음. Phase 4 baseline 산정 시 임계 확정 예정

### ASSET-8: 감사 로그 (Phase 2 도입 예정) [내부]
- 구성: 인증 성공/실패, 권한 변경, 본인 글 수정/삭제 이력 (audit_log 테이블)
- 보호 가치: Integrity + Non-repudiation
- 분류: 내부
- 위치: MySQL `audit_log` (Phase 2)
- 비고: 현 구현은 감사 로그 부재 → Repudiation 위협 노출. observability 모듈 신설 시 활성

## 공격면 (Attack Surfaces)

context/constraints.md "엔드포인트(16개)" + 외부 통합 1건 기반.

### ATTACK-SURFACE-1: 공개 인증 API (anonymous)
- 엔드포인트: `POST /users/auth/join`, `POST /users/auth/login`, `POST /users/auth/refresh`, `POST /users/auth/oauth`
- 신뢰 수준: 외부 anonymous
- 진입 자산: ASSET-1, ASSET-2, ASSET-4
- 비고: @Public 데코레이터 화이트리스트 4개. 가입/로그인은 비인증 진입점이라 brute-force / credential stuffing 최일선

### ATTACK-SURFACE-2: 인증된 사용자 정보 API
- 엔드포인트: `POST/GET/PATCH/DELETE /users/info` (@Roles USER, ADMIN)
- 신뢰 수준: 인증 사용자
- 진입 자산: ASSET-4
- 비고: nickname UNIQUE 제약, PATCH/DELETE 본인 제한

### ATTACK-SURFACE-3: 블로그 글 CRUD API
- 엔드포인트: `GET /posts`, `GET /posts/users/:postUid`, `GET /posts/:postId`, `POST /posts`, `PATCH /posts/:postId`, `DELETE /posts/:postId` (@Roles USER)
- 신뢰 수준: 인증 사용자
- 진입 자산: ASSET-5, ASSET-6
- 비고: PATCH/DELETE는 postUid==authUid 검증. ADMIN 차등 권한 미정의(unknowns.md)

### ATTACK-SURFACE-4: 좋아요 API
- 엔드포인트: `POST /posts/:postId/likes`, `DELETE /posts/:postId/likes` (@Roles USER)
- 신뢰 수준: 인증 사용자
- 진입 자산: ASSET-5
- 비고: 복합 PK(postId+uid)로 중복 방지. Phase 3에서 비동기 집계 전환 예정

### ATTACK-SURFACE-5: Google OAuth 외부 신뢰 경계
- 엔드포인트: `POST /users/auth/oauth` (외부 ID Token 수신)
- 신뢰 수준: 외부 anonymous + Google 신뢰 (google-auth-library 검증)
- 진입 자산: ASSET-1, ASSET-4
- 비고: 외부 ID Token → 내부 User Aggregate 변환의 Anticorruption Layer

### ATTACK-SURFACE-6: API Path Parameter (암호화된 PK)
- 엔드포인트: 모든 `:postId` 경로
- 신뢰 수준: 외부 anonymous 또는 인증 사용자
- 진입 자산: ASSET-6
- 비고: DecryptPrimaryKeyPipe 복호화 실패 → InvalidEncryptedParameterException. PathParamAwareValidationPipe 우회 보장 (Phase 0 #89 수정)

### ATTACK-SURFACE-7: 시크릿 환경변수 / 코드 저장소
- 위치: env/*.env, 소스 저장소
- 신뢰 수준: 개발 환경 (외부 노출 시 ASSET-3 전체 유출)
- 진입 자산: ASSET-3
- 비고: gitleaks pre-commit으로 staged 검사 (Phase 0 #78)

## STRIDE 위협 분석

각 STRIDE-N은 자산/공격면 ID를 명시 참조. 완화 후보는 problem 단계 후보 수준 (구체 컨트롤은 solution-security).

### STRIDE-1 [확정] 카테고리: Spoofing
- 대상 자산: ASSET-1, ASSET-2
- 공격면: ATTACK-SURFACE-1
- 공격 시나리오: 로그인 API에 대한 brute-force / credential stuffing / dictionary 공격. 노출된 password DB 활용 자동화 시도
- 영향: Authenticity 침해 → 비인가 계정 탈취 → ASSET-4·ASSET-5 후속 침해
- 완화 후보:
  - Rate Limiting (IP 기반 + 계정 기반) — Phase 1 @nestjs/throttler 도입 예정 (BP3 성공지표 / TP3 인접)
  - 로그인 실패 카운트 + 일시 계정 잠금 — Phase 1 도입 예정
  - 비밀번호 해싱 강화 (SHA256 3회 → argon2id, Phase 5 TP8)
  - 비정상 로그인 감지 + 알림 (Phase 2 observability + Phase 3 알림 비동기와 연계 가능)
- 우선순위: High (외부 anonymous + 기밀 자산)
- 파생 TP-N: TP8 (해싱 강화) + Phase 1 추가 항목(Rate Limit / 실패 카운트)

### STRIDE-2 [확정] 카테고리: Spoofing
- 대상 자산: ASSET-1, ASSET-4
- 공격면: ATTACK-SURFACE-5
- 공격 시나리오: Google ID Token 위조 시도, 만료 토큰 재사용, 다른 클라이언트 ID 발급 토큰 주입. 현 구현 한계: OAuth uid=payload.email이므로 동일 email로 일반 가입 시도 시 식별 충돌
- 영향: Authenticity 침해 → 타인 명의 계정 생성/탈취. ASSET-4 PII 무결성 침해
- 완화 후보:
  - ID Token aud(client_id) 검증 (google-auth-library 기본 동작 — GOOGLE_CLIENT_ID 일치)
  - ID Token exp / iss 검증 (라이브러리 기본)
  - provider_subject(sub) 기반 식별로 재설계 (Phase 1 TP5) — email은 가변/충돌 가능, sub는 불변
  - 동일 email에 대한 가입 충돌 정책 명시 (UserAuthProvider 분리, Phase 1)
- 우선순위: High
- 파생 TP-N: TP5 (User 식별자 재설계)

### STRIDE-3 [확정] 카테고리: Spoofing
- 대상 자산: ASSET-2
- 공격면: ATTACK-SURFACE-2, ATTACK-SURFACE-3, ATTACK-SURFACE-4
- 공격 시나리오: 탈취된 accessToken / refreshToken으로 정상 사용자 가장. XSS로 쿠키 외 저장소 토큰 탈취, 네트워크 도청으로 토큰 가로채기
- 영향: Authenticity 침해 → 임의 계정 권한 행사
- 완화 후보:
  - 이미 적용: HTTPOnly + sameSite=strict 쿠키, refresh 서버측 DB 대조, Token Rotation (replay 방어)
  - HTTPS 강제 (프로덕션) — secure 쿠키 자동
  - 세션 무효화 경로 (현 구현은 refreshToken 갱신/삭제로 무효화. 별도 logout 엔드포인트 명시 부재)
  - JWT_SECRET 회전 정책 (현 미정)
- 우선순위: High
- 파생 TP-N: 없음 (현 구현 적정 + 운영 정책)

### STRIDE-4 [확정] 카테고리: Tampering
- 대상 자산: ASSET-5
- 공격면: ATTACK-SURFACE-3
- 공격 시나리오: 타인 글 수정/삭제 시도(권한 우회), path param 조작으로 postUid 위조
- 영향: Integrity 침해 → 작성자 신원 무결성 침해, 콘텐츠 변조
- 완화 후보:
  - 이미 적용: postUid == authUid 저장소 검증, DecryptPrimaryKeyPipe 복호화 실패 → 거절
  - 권한 검증 분기 누락 회귀 방지 (E2E 테스트 유지)
  - ADMIN 차등 권한 명시 (unknowns.md, 도입 시점)
- 우선순위: Medium
- 파생 TP-N: 없음 (현 구현 적정)

### STRIDE-5 [확정] 카테고리: Tampering
- 대상 자산: ASSET-1, ASSET-4
- 공격면: ATTACK-SURFACE-1, ATTACK-SURFACE-2, ATTACK-SURFACE-3
- 공격 시나리오: 입력값 인젝션 — SQL Injection, NoSQL Injection(해당 없음, MySQL only), JSON 페이로드 prototype pollution, mass assignment(whitelist 누회)
- 영향: Integrity 침해 → 데이터 변조/유출
- 완화 후보:
  - 이미 적용: TypeORM parameter binding (SQL Injection 방어), class-validator + whitelist:true ValidationPipe (mass assignment 차단)
  - PathParamAwareValidationPipe로 path param 우회 보장 (Phase 0 #89)
  - 신규 엔드포인트 추가 시 동일 패턴 적용 (defensive-coding.md 규칙)
- 우선순위: Medium
- 파생 TP-N: 없음

### STRIDE-6 [확정] 카테고리: Repudiation
- 대상 자산: ASSET-8 (감사 로그, 현 부재)
- 공격면: ATTACK-SURFACE-1, ATTACK-SURFACE-3 (본인 글 수정/삭제)
- 공격 시나리오: 사용자가 본인 행동(글 삭제, 로그인 등)을 사후 부인. 현 구현은 audit_log 부재 → 행위 증거 부재
- 영향: Non-repudiation 미보장 → 분쟁 시 책임 추적 불가
- 완화 후보:
  - audit_log 테이블 신설 (Phase 2 observability)
  - 인증 성공/실패, 권한 변경, 본인 글 수정/삭제 이벤트 기록
  - Correlation ID 전파로 요청 단위 추적성 확보 (Phase 2 TP6)
- 우선순위: Medium (학습 프로젝트라 분쟁 가능성 낮으나 학습 가치 + 비동기화 관측에 필요)
- 파생 TP-N: TP6 (관측성 인프라)

### STRIDE-7 [확정] 카테고리: Information Disclosure
- 대상 자산: ASSET-4 (PII)
- 공격면: ATTACK-SURFACE-3, ATTACK-SURFACE-5
- 공격 시나리오: API 응답에 password/salt 등 민감 컬럼 노출, 로그에 PII 평문 기록, 에러 응답에 스택 트레이스 노출. 현 한계: OAuth uid=email이므로 PostEntity.postUid 응답에 email이 직접 노출되어 작성자 PII가 무관한 사용자에게 가시화
- 영향: Confidentiality 침해 → PII 유출
- 완화 후보:
  - 이미 적용: TypeORM find select 명시 가이드(CLAUDE.md), Exception Filter로 스택 트레이스 응답 차단(FailureResponse)
  - PII 마스킹: Phase 2 observability 로그 포맷에 PII 마스킹 도입 예정 (constraints.md §로깅)
  - postUid 노출 제거: Phase 1 TP5 재설계 시 email → userId(BIGINT) 전환으로 본 노출 경로 해소
- 우선순위: High (email 노출은 즉각 가시화)
- 파생 TP-N: TP5 (User 식별자 재설계 / 본 위협 직접 완화), TP6 (PII 마스킹)

### STRIDE-8 [확정] 카테고리: Information Disclosure
- 대상 자산: ASSET-6 (Primary Key 패턴)
- 공격면: ATTACK-SURFACE-6
- 공격 시나리오: AES-ECB 모드의 동일 평문 → 동일 암호문 특성으로 PK 패턴/관계 추론. PK_SECRET_KEY 16자 한정으로 brute-force 영역
- 영향: Confidentiality 침해 → PK 순서/관계 노출, 향후 키 길이 한계로 키 brute-force 가능성
- 완화 후보:
  - AES-ECB → AES-GCM 전환 (Phase 5 TP8) — IV/AAD 적용으로 패턴 노출 차단
  - PK_SECRET_KEY 16자 → 32자(AES-256) 확장 (Phase 5)
  - 키 회전 정책 (현 미정)
- 우선순위: Medium (현 단계 학습 프로젝트, Phase 5 전환 계획됨)
- 파생 TP-N: TP8 (PK 암호화 전환)

### STRIDE-9 [확정] 카테고리: Information Disclosure
- 대상 자산: ASSET-3
- 공격면: ATTACK-SURFACE-7
- 공격 시나리오: 시크릿 코드 저장소 커밋, 로그/에러 응답에 환경변수 노출, .env 파일 외부 유출
- 영향: Confidentiality 침해 → 전 시스템 침해 가능 (JWT 위조 / DB 직접 접근)
- 완화 후보:
  - 이미 적용: gitleaks pre-commit 훅 (Phase 0 #78), .gitignore의 env 디렉토리, ConfigService 사용 강제(CLAUDE.md)
  - 로그 PII 마스킹과 동일 경로로 시크릿 마스킹 (Phase 2)
  - 키 회전 정책 (Phase 5 이후 검토)
- 우선순위: High (단일 유출 사고로 전 시스템 침해)
- 파생 TP-N: 없음 (현 구현 + Phase 2 마스킹으로 적정)

### STRIDE-10 [확정] 카테고리: Denial of Service
- 대상 자산: ASSET-7
- 공격면: ATTACK-SURFACE-1, ATTACK-SURFACE-3
- 공격 시나리오: 로그인 API 대량 호출(brute-force 부수효과), 무거운 글 조회 반복, 동시 다중 요청으로 동기 처리(hits 증가, PostLike count) 자원 고갈
- 영향: Availability 침해 → 정상 사용자 응답 지연/실패
- 완화 후보:
  - Rate Limiting (Phase 1 @nestjs/throttler — STRIDE-1과 공유)
  - 동기 집계의 비동기 전환 (Phase 3 TP1 — hits/likes 큐 기반 집계)
  - Idempotency-Key로 중복 요청 차단 (Phase 1, TP3 인접)
  - 가용성 모니터링/알람 (Phase 2 observability) — 임계는 NFR 활성 시점(Phase 4)에 정량화
- 우선순위: Medium (NFR 비활성으로 정량 임계 부재. 로컬 학습 환경 수용 가능)
- 파생 TP-N: TP1, TP6, Phase 1 Rate Limit

### STRIDE-11 [확정] 카테고리: Elevation of Privilege
- 대상 자산: ASSET-5, ASSET-4
- 공격면: ATTACK-SURFACE-2, ATTACK-SURFACE-3, ATTACK-SURFACE-4
- 공격 시나리오: @Public 화이트리스트에 의도치 않은 엔드포인트 추가, AuthGuard 우회, Roles 검증 누락, 본인 검증(postUid==authUid) 누락으로 타인 자원 조작
- 영향: 권한 상승 → 비인가 자원 접근/변조
- 완화 후보:
  - 이미 적용: 전역 AuthGuard 기본 적용, @Public allowlist 방식 (defensive-coding.md), 본인 검증 저장소 레이어
  - 신규 엔드포인트 추가 시 인증/인가 패턴 적용 강제 (defensive-coding.md "인증/인가" 규칙)
  - ADMIN 차등 권한 도입 시 Decision Table 적용 (unknowns.md 트리거)
  - E2E 테스트로 권한 회귀 방지
- 우선순위: High (구조적 회귀 시 광범위 영향)
- 파생 TP-N: 없음 (현 구현 + 운영 규칙)

## OWASP Top 10 2021 매핑

solution-security 입력 계약. 각 STRIDE-N의 완화 후보가 solution-security에서 구체 보안 컨트롤로 발전.

| STRIDE-N | 카테고리 | OWASP 2021 |
|---|---|---|
| STRIDE-1 | Spoofing (brute-force) | A07 Identification and Authentication Failures |
| STRIDE-2 | Spoofing (OAuth 위조) | A07 Identification and Authentication Failures |
| STRIDE-3 | Spoofing (토큰 탈취) | A07 Identification and Authentication Failures / A02 Cryptographic Failures |
| STRIDE-4 | Tampering (권한 우회 수정) | A01 Broken Access Control |
| STRIDE-5 | Tampering (입력 인젝션) | A03 Injection / A08 Software and Data Integrity Failures |
| STRIDE-6 | Repudiation (감사 부재) | A09 Security Logging and Monitoring Failures |
| STRIDE-7 | Info Disclosure (PII) | A01 Broken Access Control / A02 Cryptographic Failures |
| STRIDE-8 | Info Disclosure (PK 패턴) | A02 Cryptographic Failures |
| STRIDE-9 | Info Disclosure (시크릿) | A05 Security Misconfiguration / A02 Cryptographic Failures |
| STRIDE-10 | Denial of Service | A05 Security Misconfiguration / A04 Insecure Design |
| STRIDE-11 | Elevation of Privilege | A01 Broken Access Control / A04 Insecure Design |

## QAS 정합

본 프로젝트는 problem/overview.md §비기능 요구 NFR 비활성 상태(목표 RPS/p99/동시 사용자/데이터 volume 미확정). 따라서 Security/Availability QAS-N 정의가 부재하며 본 섹션의 정량 정합 검증은 비활성.

활성 시 검증 대상 (Phase 4 진입 시점 NFR 활성 전환 후):
- DoS 임계 (STRIDE-10) ↔ Availability QAS Response Measure
- Rate Limit 차단율 (STRIDE-1 완화) ↔ Security QAS Response Measure
- 인증 실패 감지 시간 (STRIDE-1, STRIDE-6) ↔ Security QAS Response Measure

상호 참조: docs/context/unknowns.md "부하 테스트 목표 규모 가정".

## 단계간 재통과 트리거

본 threat-model.md는 mcpsi-updator §4.7 트리거 5번(외부 제약 변경) 보안 영역 발화 시 재평가 대상이다. 발화 조건 예:
- 새 외부 노출 API 추가 (ATTACK-SURFACE-N 추가)
- 신규 규제 적용 (GDPR/PCI-DSS 등)
- 새 민감 데이터 처리 추가 (ASSET-N 추가)

발화 시 Problem 단계 본 문서 재실행 + solution-security 영향 재통과(verify가 식별).

## Sources

- docs/context/constraints.md §연동 요구사항 / §기존 코드 상태 / §보안 관련 경로 후보
- docs/context/domain.md §Ubiquitous Language / §도메인 규칙·제약 (인증/권한 규칙)
- docs/context/unknowns.md §도메인 (ADMIN 차등 권한) / §비즈니스 (부하 테스트 목표 규모)
- docs/problem/overview.md TP1·TP3·TP5·TP6·TP8 (파생 매핑) + §보안/위협 모델링 활성 판정
- docs/problem/domain-spec.md (도메인 Invariant 보존 — 권한 본인 검증)
- docs/problem/use-cases.md (UC 인증/권한 흐름)
- docs/meeting-logs/2026-04-24.md (MCPSI 신규 수립)
- docs/meeting-logs/2026-05-11.md (Phase 0 종료에 따른 시크릿 스캔/ValidationPipe 흡수)
- .claude/rules/defensive-coding.md (환경 보호 / 인증/인가 / 시크릿 관리 규칙)
- 방법론: Microsoft SDL Threat Modeling (Kohnfelder & Garg 1999) / Shostack 2014 STRIDE-per-element / OWASP Top 10 2021
