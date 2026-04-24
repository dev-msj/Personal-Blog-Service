# Context

## 비즈니스 맥락

이 프로젝트는 백엔드 개발 역량 성장을 위한 개인 학습/연구 프로젝트다. 단순 CRUD API 구축을 넘어 비동기 시스템(cache, queue, Kafka 등)을 적용하고 부하 테스트를 통해 백엔드 서버의 비동기 성능을 튜닝하는 경험을 쌓는 것이 장기 목표다.

"동작하는 API" 자체가 산출물이 아니라 "기술적 결정의 근거와 측정 가능한 검증 사이클"이 산출물이다. 아키텍처와 기술 결정을 문서로 관리하며 체계적으로 발전시키는 것이 핵심 가치이며, MCPSI 파이프라인을 통한 근거 문서화가 프로젝트 운영 원칙이다.

### 사업 목표 및 성공 지표

학습 프로젝트의 특성상 수익 목표 대신 역량 성장 기준으로 정량화한다.

1. 비동기 기술 적용 체크리스트 (Phase별 달성 단위)
   - Redis 애플리케이션 캐시 계층 도입 완료
   - 작업 큐 도입 완료 (구체 기술은 Solution 단계에서 확정)
   - Kafka 이벤트 기반 비동기 처리 도입 완료
   - 각 기술 도입 판정 기준: MCPSI solution 문서 확정 + 구현 머지 + Type A(설계) 블로그 + Type B(회고) 블로그(측정 포함) 세트 완료

2. 기능 완성도 및 리팩토링 체크리스트
   - 현재 미구현 기능 완성 (댓글 #6, 답글 #7, 중복 요청 방지 캐시 #11 등)
   - 이후 적용할 비동기 기술 단계마다 기존 코드 리팩토링 계획 동반 수립 및 실행 (기능 추가와 구조 개선을 페어링)

3. 시스템 관측성 가시화 (백엔드 필수 지표로 편입)
   - 요청 ID 기반 구조화 로깅 연결 완료 (Correlation ID 전파)
   - 메트릭/트레이싱 계층 도입 (업계 표준 기준, 예: Prometheus/Grafana/OpenTelemetry 중 Solution 단계에서 선정)
   - 운영 대시보드 구축 (병목 지점 및 설계 오류 탐지를 위한 가시화)
   - 근거: 관측성이 없으면 비동기화 성과를 측정할 수 없고 튜닝의 대상 지점도 확정 불가

4. 부하 테스트 기반 성능 검증 (수치 목표 미확정)
   - "베이스라인 측정 → 튜닝 → 재측정" 사이클 최소 1회 완수
   - 수치 목표(RPS, p99 latency, 동시 사용자)는 목표 규모 가정 확정 후 산정 (알려진 불확실성 3으로 승계)

5. Type A/B 블로그 편수는 성공 지표에서 제외
   - 근거: 편수 기반 목표는 계획 인플레이션을 유발. 주제별 품질 기준(CLAUDE.md "기술 블로그 문서화 규칙")을 만족한 문서가 산출되면 충분

### 수익 모델

해당 없음 (개인 학습/연구 프로젝트).

## 이해관계자

- 개발자 1명 (사용자 본인): 모든 역할 수행 (기획/설계/구현/테스트/운영). 학습 및 역량 성장이 관심사
- 의사결정 구조: 단일 의사결정자. 모든 기술/설계 결정을 사용자 본인이 수행
- 외부 독자 (잠재): Type A/B 블로그의 잠재 독자. 외부 공유 가치가 있는 주제는 블로그로 공개

## Ubiquitous Language

단일 BC 프로젝트이므로 Context 표기는 생략.

- uid: 사용자 고유 식별자 (문자열, 100자). 사용처: UserAuthEntity PK, JWT payload sub 클레임, request.headers['authenticatedUser']
- UserAuth: 사용자 인증 정보 집합 (uid, password, salt, refreshToken, userRole, socialYN). 사용처: UserAuthEntity (USER_AUTH 테이블), 인증/인가 전체
- UserInfo: 사용자 프로필 정보 (uid, nickname, introduce). nickname은 UNIQUE 제약. 사용처: UserInfoEntity (USER_INFO 테이블), 프로필 조회/수정
- UserRole: 사용자 역할 enum. ADMIN, USER 두 값 정의. 현 구현에서 두 역할의 차등 권한은 @Roles 데코레이터 매칭 외 실질 구현 없음 (알려진 불확실성 5로 승계). 사용처: @Roles 데코레이터, AuthGuard 역할 검증
- socialYN: 소셜 로그인 가입 여부 플래그 ('Y' 또는 'N' 단일 char). 사용처: UserAuthEntity, Google OAuth 분기 처리
- Post: 블로그 글 (postId, postUid, title, contents, hits, 타임스탬프). 사용처: PostEntity (POST 테이블)
- postUid: Post의 작성자 식별자 외래키. PostEntity에서 UserAuthEntity.uid 참조. 사용처: 작성 권한 검증 (본인 수정/삭제 판단)
- Hits: 글 조회수. 상세 조회 시 동기 증가. 사용처: PostEntity.hits (기본값 0), 현재 동기 처리 중으로 비동기화 후보
- PostLike: 좋아요 관계 엔티티. postId + uid 복합 PK로 1인 1회 제한을 스키마 수준에서 강제. 사용처: PostLikeEntity (POST_LIKE 테이블)
- UserSession: TypeORM 엔티티가 아닌 인메모리 값 객체. RefreshToken 검증 결과를 담음. 사용처: AuthGuard 내부
- Primary Key 암호화: API 경계에서 정수 PK를 AES 암호화 문자열로 치환. Service/Repository 내부는 평문 사용. 사용처: @EncryptField 데코레이터, DecryptPrimaryKeyPipe(요청), EncryptPrimaryKeyInterceptor(응답)
- AccessToken: JWT 형식. Authorization 헤더 "Bearer {token}" 전달. 기본 유효 1시간
- RefreshToken: JWT 형식. HTTPOnly 쿠키 전달. 기본 유효 30일. DB(USER_AUTH.refreshToken)에 저장되어 이중 검증
- Token Rotation: refresh 호출 시 access + refresh 둘 다 재발급하며 DB 저장값도 갱신. replay 공격 방어 내장

## Bounded Contexts 초안

단일 BC.

- 이름: Blog Service
- 책임 영역: 사용자 인증/프로필 관리 + 블로그 글 CRUD + 좋아요 관계
- 담당 팀: 단일 개발자 (사용자 본인)
- 주요 Aggregate 후보 (현 구현 기준, Solution 단계에서 확정): User(UserAuth + UserInfo), Post(Post + PostLike)

## Context Map 초안

해당 없음 (단일 BC). 외부 통합은 Google OAuth ID Token 검증 1건뿐이며, 이는 BC 간 관계가 아닌 외부 서비스 Anticorruption Layer 수준의 단순 사용.

## 도메인 지식

### 도메인 규칙 (현 구현에서 추출)

1. 회원 관리
   - 신규 가입: uid 중복 검증 후 USER 역할 기본 할당 (src/user/service/user-auth.service.ts:35-66)
   - 비밀번호 저장: salt + SHA256 3회 반복 해싱 후 저장
   - Google OAuth 가입: 기존 uid 존재 여부 확인. 없으면 자동 신규 가입 (socialYN='Y'), 있으면 기존 계정 로그인
   - 토큰 갱신: access + refresh 둘 다 재발급 (Token Rotation). DB에 저장된 refreshToken 함께 업데이트

2. 인증 흐름
   - 모든 엔드포인트 기본 인증 필수 (AuthGuard 전역 적용)
   - @Public() 데코레이터로 명시적 화이트리스트 (공개 엔드포인트 4개: join, login, refresh, oauth)
   - 이중 검증: Authorization 헤더의 accessToken (JWT 서명/만료) + HTTPOnly 쿠키의 refreshToken (DB 저장값과 대조)
   - 두 토큰 중 하나라도 실패 시 401
   - 배경 조사 문서: docs/tech-notes/token-validation-strategies.md (Phase 0 Type A 블로그)

3. 글 관리
   - 작성 권한: 인증된 사용자 (USER 역할)
   - 수정/삭제 권한: 본인만 (postUid == authUid로 저장소에서 검증). ADMIN 차등 권한 미구현
   - 목록 조회: 최신순, 페이지당 20개 고정 (TAKE=20)
   - 상세 조회 시 hits 동기 증가

4. 좋아요
   - 1인 1회 제한: postId + uid 복합 PK로 스키마 강제
   - 자기 글 좋아요 가능 (명시적 제약 없음)
   - 취소 가능 (DELETE 엔드포인트 제공)

### 워크플로우

사용자 작업 흐름:

1. 회원가입 (uid+password) 또는 Google OAuth 로그인
2. UserInfo 생성 (nickname, introduce)
3. 전체 글 목록 또는 특정 사용자 글 목록 조회
4. 글 상세 조회 (hits 증가)
5. 좋아요 추가 또는 취소
6. 본인 글 작성/수정/삭제

이 서비스는 외부 블로그 프론트엔드/모바일 앱의 백엔드로 동작하는 것을 상정. 프론트엔드는 이 프로젝트 범위 밖.

### 참고 서비스/벤치마크

특정 레퍼런스 서비스 없음. 업계 실무상 일반화된 기준을 최소 가이드라인으로 채택.

가이드라인 기준 (Solution 단계의 근거 후보):

- 인증: RFC 7519 JWT, RFC 6749 OAuth 2.0, OWASP Authentication Cheat Sheet
- 로깅: 12-Factor App XI (Logs as event streams), 구조화 로깅 일반 관행
- 관측성: CNCF Observability Standards, OpenTelemetry 사양 (Traces/Metrics/Logs)
- 캐싱: Cache-Aside / Read-Through / Write-Through 표준 패턴
- 비동기 메시징: Hohpe & Woolf "Enterprise Integration Patterns", Transactional Outbox, Richardson "Microservices Patterns" Saga
- 이벤트 스트리밍: Kafka 공식 문서, Kleppmann "Designing Data-Intensive Applications"
- 안정성: Nygard "Release It!" Stability Patterns (Timeout/Circuit Breaker/Bulkhead 등)

## 기술 제약

### 기존 시스템과의 연동

- Google OAuth 2.0 ID Token 검증 (google-auth-library 라이브러리). 환경변수 GOOGLE_CLIENT_ID 필요

### 인프라/예산/인력 제약

- 인력: 1명 (사용자 본인)
- 예산: 현재 자체 개발 장비에서 로컬 Docker Compose 실행만 전제 (추가 비용 없음)
- 클라우드 배포는 예산 여유 확보 시 검토 (알려진 불확실성 6)
- 부하 테스트도 현 단계에서는 로컬 환경 기준

### 기술 스택 제약

확정된 스택 (기존 구현 기반):

- 런타임: Node.js
- 프레임워크: NestJS 10 (TypeScript)
- ORM: TypeORM (쿼리 캐시 활성, 테스트 환경은 비활성 분기)
- DB: MySQL 8.0
- 캐시: Redis
- 테스트: Jest (unit + supertest 기반 E2E)
- 검증: Joi (환경변수), class-validator (DTO)
- 인증: jsonwebtoken (passport 미사용, 직접 구현)
- 로깅: nest-winston + winston-daily-rotate-file
- 암호화: crypto-js (AES-ECB)
- OAuth: google-auth-library
- 환경: Docker Compose

TypeScript 설정:
- strictNullChecks: true
- noImplicitAny: true
- target: ES2021

컨테이너 포트:
- 개발: MySQL 3306, Redis 6379 (docker-compose.yaml)
- 테스트: MySQL 3307, Redis 6380 (docker-compose.test.yaml, MySQL healthcheck 포함)
- 테스트 DB/캐시 경로: data/mysql-test, data/redis-test

### 기술 환경 조사 결과

#### JWT 토큰 무효화 전략 (Phase 0 baseline, PR #44 파생)

3가지 전략 비교:
- 블랙리스트(Denylist): 무효화된 토큰만 등록. 등록 전까지 탈취 토큰 유효 (한계)
- Allowlist(세션 ID): 유효 세션만 허용. 별도 세션 인프라 구축 부담
- Refresh Token 서버측 검증: 매 요청마다 refreshToken을 DB 저장값과 대조

채택: Refresh Token 서버측 검증. 근거는 (1) 기존 UserAuthEntity.refreshToken 필드 활용으로 추가 스키마 변경 없음 (2) HTTPOnly 쿠키 기반 XSS 방어 계층 확보 (3) Token Rotation으로 replay 방어 내장. 현 한계: 매 요청 DB 직접 조회로 성능 부담. 향후 cache-aside(Redis) 적용 계획.

상세 문서: docs/tech-notes/token-validation-strategies.md

#### 의존성 버전 갭 분석 (2026-04-24 수행)

상세 버전은 package.json 참조. 이 섹션은 조사 결과와 후속 판단 대상만 기록.

주요 major 갭 (Problem/Solution 단계의 업그레이드 판단 입력):
- NestJS 10 → 11: Express v5 경로 매칭(와일드카드 명명 강제), CacheModule의 Keyv 전환(cache-manager-ioredis 어댑터 호환성 재검증 필요), Reflector 반환 타입 변경, 종료 lifecycle hook 순서 역전
- TypeScript 5 → 6 (stable) / 7 (Beta 진행 중, Go 기반 컴파일러). 6는 JS 기반 마지막 릴리스이자 7 전환 준비 성격
- Jest 29 → 30: Node 18+ 요구. 현 프로젝트가 Node 런타임 버전 미선언이라 선행 확인 필요
- TypeORM 0.3.17 → 0.3.28: 같은 0.3.x 계열 내 patch/minor 갭. 파괴적 변경 가능성 낮음

구조적 공백:
- Node.js 런타임 버전 선언 누락: .nvmrc, package.json engines 필드, GitHub Actions workflow의 node-version 모두 미선언. 개발자 로컬 환경에 암묵 의존 → 재현성/CI 리스크. Jest 30 등 상위 버전 도입 전제 조건
- `redis ^5.8.2` 패키지 선언되어 있으나 src 내 직접 import 없음(실제 사용은 `cache-manager-ioredis`). 제거 후보 또는 용도 확인 필요

액션 가이드 (Problem/Solution 단계에서 결정):
- Node.js 런타임 버전 명시 (.nvmrc + engines + CI workflow 3곳 일관 선언)은 구조적 공백이므로 우선 처리 대상. 어느 Phase에 편입할지는 Problem에서 판단
- NestJS/TypeScript/Jest major 업그레이드는 독립 판단. 학습 가치는 있으나 현 코드 기능 완성과 상충할 수 있으므로 별도 Phase 또는 별도 트랙 가능성 검토
- TypeORM 0.3 계열 patch 업그레이드는 리스크 낮음, 개별 처리 가능
- `redis` 패키지 용도 확인 후 제거 또는 역할 문서화 (경량 정리 작업)

상세 후속 판단: 알려진 불확실성 8로 승계

### 기존 코드 상태 (2026-04-24 기준)

모듈 구성:
- auth/ (AuthGuard)
- blog/ (posts, likes)
- user/ (auth, profile, OAuth, jwt)
- health/ (Redis health check)
- config/ (TypeORM, Redis, Winston, JWT, env validation)
- constant/, decorator/, filter/, interceptor/, pipe/, exception/, response/, utils/

엔티티 (4개):
- UserAuthEntity: uid(PK, 100자), password, salt, refreshToken, socialYN(char), userRole(enum), 타임스탬프
- UserInfoEntity: uid(PK, 100자), nickname(UNIQUE, 100자), introduce(500자), 타임스탬프
- PostEntity: postId(AUTO_INCREMENT PK), postUid(INDEX, 100자), title(500자), contents(text), hits(int, default 0), writeDatetime, 타임스탬프
- PostLikeEntity: (postId + uid) 복합 PK, 타임스탬프

관계:
- UserAuth 1:1 UserInfo (CASCADE)
- UserAuth 1:N Post (CASCADE, postUid 외래키)
- UserAuth 1:N PostLike (CASCADE)
- Post 1:N PostLike (CASCADE)

엔드포인트 (16개):
- 공개(@Public): POST /users/auth/join, /users/auth/login, /users/auth/refresh, /users/auth/oauth
- 유저 정보: POST/GET/PATCH/DELETE /users/info (@Roles USER, ADMIN)
- 글: GET /posts, GET /posts/users/:postUid, GET /posts/:postId, POST /posts, PATCH /posts/:postId, DELETE /posts/:postId (모두 @Roles USER)
- 좋아요: POST /posts/:postId/likes, DELETE /posts/:postId/likes (@Roles USER)

테스트:
- Unit: 14개 파일 (auth service, jwt service, user-info service, post service, post-like service, interceptors, pipes, utils, filters, health, DTO)
- E2E: 3개 파일 (user-auth.e2e-spec.ts, post.e2e-spec.ts, app.e2e-spec.ts)
- 테스트 환경: 실제 컨테이너 기반, maxWorkers=1, testTimeout=30s

마이그레이션 상태:
- migrations/ 디렉토리 존재하나 파일 없음
- 개발 환경: TypeORM synchronize: true로 자동 스키마 생성
- 프로덕션 마이그레이션 전략 미수립 (알려진 불확실성 7)

문서-코드 불일치 (Context 단계에서 식별):
- CLAUDE.md의 UserInfoEntity에 profileImageUrl, bio 기재
- 실제 엔티티는 introduce 필드만 존재
- 처리 방침: context.md는 코드 기준 기술. CLAUDE.md 재작성은 Context 단계 범위 밖으로 후속 과제 분리

### 보안 관련 경로 후보 (향후 security Extension 입력)

- 인증 진입점: src/auth/auth.guard.ts, src/user/service/user-auth.service.ts, src/user/service/jwt.service.ts
- 시크릿 관리: 환경변수 PK_SECRET_KEY(정확히 16자), JWT_SECRET, GOOGLE_CLIENT_ID, REDIS_PASSWORD, DB_PASSWORD
- 비밀번호 해싱: SHA256 3회 반복 + salt (bcrypt/argon2 전환 검토 여지)
- PK 보호: AES-ECB (src/utils/crypto.utils.ts). ECB 모드는 일반적으로 권장되지 않음 (보안 재검토 여지)
- 쿠키: HTTPOnly + secure(프로덕션) + sameSite=strict 기본

### CI/CD

- GitHub Actions `.github/workflows/main.yml`
- 트리거: 브랜치 생성 (create 이벤트)
- 동작: 브랜치명에서 이슈 번호 추출 → GitHub Projects V2에서 해당 이슈를 "In Progress"로 자동 이동
- 필요 secret: PROJECT_TOKEN

### Git 전략

- GitHub Flow
- 브랜치 네이밍: `<타입>/<이슈번호>-<설명>` (feature / bugfix / hotfix / refactor / docs)
- 머지: Squash Merge, 머지 후 원격/로컬 브랜치 삭제
- 훅: Husky + lint-staged
  - pre-commit: ESLint --fix + Prettier --write
  - pre-push: npm run build

## 시간 제약

- 데드라인: 없음 (학습 품질 우선)
- Phase별 목표 시점: 미설정. 시간 기반이 아닌 품질 기반으로 Phase 전환 판정
- 우선순위 방향성: 기능 완성 → 관측성 가시화 → 비동기화 → 부하 테스트 (Problem/Solution 단계에서 Phase 근거와 함께 확정)

## 알려진 불확실성

1. Phase 개수 및 각 Phase의 범위
   - 후속: /mcpsi-problem 단계
   - 영향: Phase 분리 근거가 확정되기 전에는 기존 이슈 재분류 불가

2. 기존 14개 열린 이슈 각각의 Phase 재분류 (편입 / 기각 / 보류)
   - 후속: /mcpsi-implementation 단계의 "기존 마일스톤/이슈 정리" 절차
   - 영향: 비동기/성능 학습 목표와 연결되는 이슈(#11 중복요청 캐시, #38 Redis 자료구조, #40 모니터링 등)의 Phase 위치 미확정

3. 부하 테스트 목표 규모 및 수치 기준
   - 후속: /mcpsi-solution 단계 (observability Extension 또는 별도 검토)
   - 영향: 목표 규모(RPS, 동시 사용자, 데이터 volume) 가정이 선행되어야 수치 산정 가능. 현재는 "베이스라인 측정 → 튜닝 → 재측정 사이클 완수" 수준만 합의

4. 첫 블로그 Type A/B 확정/후보 목록
   - 후속: /mcpsi-implementation 단계의 "Phase 산출 문서" 선언 시점
   - 영향: 현 시점 후보군(부하 테스트 베이스라인, N+1 해소, 조회수 비동기화, Redis 자료구조, Kafka 도입, JWT refresh rotation)의 최종 분류 미확정

5. ADMIN vs USER 역할의 차등 권한 정의
   - 후속: 기능 완성 Phase 또는 권한 확장 시점
   - 영향: 현 구현에서 @Roles(USER)와 @Roles(USER, ADMIN)의 실질 차이가 @Roles 매칭 외에는 없음. ADMIN도 타인 글 수정/삭제 불가

6. 클라우드 배포 시 인프라 선택 (미래 고려사항)
   - 후속: 예산 확보 시점
   - 영향: 현 단계는 로컬 Docker Compose 전제. 향후 확장 시 infra Extension에서 구체화

7. 프로덕션 마이그레이션 전략 (Phase 0에서 해소 예정)
   - 후속: Phase 0에서 migrations 활성화 + `synchronize:false` 전환 + 현 스키마 기준 마이그레이션 export
   - 영향: Phase 1 User Aggregate 재설계가 첫 실제 마이그레이션 사례. 학습 가치(데이터 보존형 마이그레이션 로직 작성 경험) 확보

8. 의존성 메이저 업그레이드 여부 및 편입 Phase
   - 후속: /mcpsi-problem 단계에서 Phase 편입 여부 판단, /mcpsi-solution 단계에서 구체 버전/순서 확정
   - 영향: Node.js 런타임 버전 선언(구조적 공백), NestJS 10→11, TypeScript 5→6/7, Jest 29→30 각각의 업그레이드가 Phase 1(기능 완성)과 상충할지, 별도 리팩토링 트랙으로 분리할지 미확정

## Sources

- docs/meeting-logs/2026-04-24.md (결정 1-7, 미결정 1-4 전체)
- 기존 코드 분석 (Explore 에이전트, 2026-04-24): 엔티티 구조, API 엔드포인트 전수 조사, 서비스 레이어 도메인 규칙, 테스트 파일 목록, 설정 파일
- package.json (패키지 의존성 관리 소스)
- CLAUDE.md (프로젝트 영구 규칙, 단 UserInfoEntity 필드 기재는 코드와 불일치로 후속 과제 분리)
- docs/tech-notes/token-validation-strategies.md (Phase 0 auth baseline)
- 의존성 버전 갭 조사 (2026-04-24 WebSearch): NestJS 11, Node.js LTS 일정, TypeScript 6/7, TypeORM 0.3.x, Jest 30, NestJS 10→11 migration notes
