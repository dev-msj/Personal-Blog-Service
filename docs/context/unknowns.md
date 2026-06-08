---
migrated: abundant-nibbling-toast-S-2
---

# Context — Unknowns

알려진 불확실성. 미결정 사항·후속 확인 필요 항목·HotSpot을 영역별로 정리.

Phase 0 closure(2026-05-11) 시점에서 해소된 항목은 본 파일에서 제거하고 constraints.md "기존 코드 상태"에 closure 사실로 흡수했다. 이력은 백업 파일(.claude/migrations/abundant-nibbling-toast-S-2/backup/docs/context.md §알려진 불확실성)에서 확인 가능.

## 비즈니스/이해관계자/시간 (overview 영역)

- 부하 테스트 목표 규모 가정 (RPS / p99 latency / 동시 사용자 / 데이터 volume)
  - 무엇이 미결정인가: Phase 4 baseline 측정 시 사용할 목표 규모 가정 수치
  - 왜 결정하지 못했는가: 1인 학습 프로젝트로 실 사용자 트래픽 없음. 가정 기반 산정이 필요하나 가정 자체가 학습 가치 있는 선택
  - 다음 액션: /mcpsi-solution observability Extension 또는 Phase 4 진입 시점에 산정. 본인이 결정
  - 영향 범위: Phase 4 부하 테스트 시나리오 / Phase 5 재측정 동일 시나리오 / observability QAS

## 도메인 (domain 영역)

- ADMIN vs USER 역할의 차등 권한 정의
  - 무엇이 미결정인가: ADMIN이 USER 대비 어떤 추가 권한을 갖는지의 도메인 규칙
  - 왜 결정하지 못했는가: 현 구현은 @Roles(USER)와 @Roles(USER, ADMIN)의 실질 차이가 매칭 외에 없음. ADMIN도 타인 글 수정/삭제 불가
  - 다음 액션: 기능 완성 Phase(Phase 1) 또는 권한 확장 시점에 결정. 본인이 결정
  - 영향 범위: Phase 1 또는 별도 Phase. 신규 엔드포인트/관리자 기능 도입 시점

- Event Storming / Domain Event 인벤토리 미수행
  - 무엇이 미결정인가: Phase 3 비동기 이벤트 도입 시 사용할 Domain Event 명세 (Aggregate별 이벤트 인벤토리)
  - 왜 결정하지 못했는가: 비동기화가 Phase 3 영역이며 사전 인벤토리 작성보다 Phase 3 진입 시 Solution 단계에서 도출이 적시
  - 다음 액션: /mcpsi-solution async-processing.md 작성 시점. docs/solution/async-processing.md §이벤트 계약에 명시 예정
  - 영향 범위: Phase 3 BullMQ + Kafka + Outbox 설계

- 타인 프로필 조회 (소셜 열람) 기능 — 미유입 백로그 (#34)
  - 무엇이 미결정인가: GET /user-info/:userId로 타인 프로필을 조회하는 소셜 기능을 도메인 범위에 포함할지, 포함 시 권한/프라이버시 모델
  - 왜 결정하지 못했는가: GitHub 이슈 #34에만 존재하고 authoritative 문서에 대응 UC/도메인 규칙이 없는 미유입 요구. use-cases.md UC 인벤토리(UC-1~9)에 타인 프로필 조회 UC 부재 → 파생 근거 없음. 본문의 uid VARCHAR 경로 전제는 Phase 1에서 폐기되어 stale. 위 "ADMIN 차등 권한" 미결의 타인 자원 접근 모델과 통합 검토 필요
  - 다음 액션: Phase 1 종료 후 또는 소셜 기능 Phase 진입 시 /mcpsi-meeting-log → context(도메인 범위/프라이버시) → problem(신규 UC + threat: 타인 정보 노출 읽기 IDOR) 재유입. 이슈 재작성/구현이 아닌 MCPSI 재유입이 올바른 처리. 본인이 결정
  - 영향 범위: 신규 UC + INV, user-info controller/service, STRIDE-4·STRIDE-11(타인 자원 읽기) 완화. 채택 시 C/P[단계간] 트리거

## 기술/코드 (constraints 영역)

- 클라우드 배포 시 인프라 선택
  - 무엇이 미결정인가: AWS / GCP / 온프레미스 등 배포 환경
  - 왜 결정하지 못했는가: 현 단계는 로컬 Docker Compose 전제. 예산 확보 시점에 검토
  - 다음 액션: 예산 확보 시점. 본인이 결정. infra Extension에서 구체화
  - 영향 범위: Phase 4 이후 운영 환경 / 부하 테스트 환경 결정

- 의존성 메이저 업그레이드 (NestJS 11 / TypeScript 6→7 / Jest 30) Phase 5 편입 세부 일정
  - 무엇이 미결정인가: 각 업그레이드의 Phase 5 내 실행 순서, NestJS 11 마이그레이션 시 Express v5 경로 매칭 / cache-manager-ioredis 어댑터 호환성 / Reflector 반환 타입 변경 / 종료 lifecycle hook 순서 역전의 실제 마이그레이션 비용
  - 왜 결정하지 못했는가: Phase 5 진입은 Phase 4 baseline 측정 종료 이후. 사전 결정 시 Phase 1~4 학습 입력에 의존
  - 다음 액션: /mcpsi-solution 시점에 Phase 5 항목으로 명문화 (현 docs/solution/overview.md §Phase 5에 일부 반영). 실행 순서는 Phase 5 진입 시점에 별도 미팅 로그
  - 영향 범위: Phase 5 품질 개선 영역. argon2id, AES-GCM, RFC 9457 Problem Details 전환과 함께 단일 Phase 묶음

- Redis 자료구조 최적화 + 캐시 전략 재설계 — 미유입 백로그 (#38)
  - 무엇이 미결정인가: TypeORM Query Result Cache(String 단일) → 도메인별 Redis 자료구조(Hash/Set/Sorted Set) 전환 + cache-aside 전략의 구체 설계와 귀속 Phase(Phase 2 캐시 개선 vs Phase 5 품질 개선)
  - 왜 결정하지 못했는가: GitHub 이슈 #38에만 존재하고 solution-level 캐시 설계로 정형화되지 않은 미유입 결정. constraints.md L54에 cache-aside 향후 계획 스레드만 존재. 본문 전제(cache-manager-ioredis 미사용 레이어 활용)는 #76에서 폐기되어 stale. 우선순위는 Phase 4 baseline 측정(캐시 병목 여부) 결과가 입력
  - 다음 액션: Phase 4 측정 결과 확인 후 /mcpsi-meeting-log → /mcpsi-solution data-design(Redis 키 구조/캐시 전략) 재유입. stale 전제(cache-manager) 정리 포함. 본인이 결정
  - 영향 범위: data-design Redis 키 구조, 성능 튜닝 로드맵(Phase 4 측정 → Phase 5 개선). 채택 시 S[단계간] 트리거

## 후속 확인 액션

| 항목 | 담당 | 시점 | 영향 범위 |
|------|------|------|----------|
| 부하 테스트 목표 규모 산정 | 본인 | /mcpsi-solution observability 또는 Phase 4 진입 | Phase 4 baseline, Phase 5 재측정. STRIDE-10(DoS) 정량 임계 |
| ADMIN 차등 권한 정의 | 본인 | Phase 1 또는 별도 Phase | 관리자 기능 도입 시점. STRIDE-4·STRIDE-11 완화 정밀화 |
| Domain Event 인벤토리 | 본인 | /mcpsi-solution async-processing | Phase 3 비동기 설계 |
| 클라우드 인프라 선택 | 본인 | 예산 확보 시점 | Phase 4 이후 운영/측정 환경 |
| 의존성 메이저 업그레이드 실행 순서 | 본인 | Phase 5 진입 미팅 로그 | Phase 5 품질 개선 |
| 타인 프로필 조회 기능 재유입 (#34) | 본인 | Phase 1 종료 후 또는 소셜 기능 Phase 진입 시 /mcpsi-meeting-log → context/problem | 신규 UC+INV, STRIDE-4·STRIDE-11. C/P[단계간] |
| Redis 자료구조/캐시 전략 재유입 (#38) | 본인 | Phase 4 측정 후 /mcpsi-meeting-log → /mcpsi-solution data-design | data-design Redis 키 구조, 성능 튜닝. S[단계간] |

## Problem 단계에서 발견된 추가 불확실성

(Problem 단계 진행 중 새로 식별된 미결정 사항. Context 단계 unknowns와 영역이 겹치면 위 표 "영향 범위"에 갱신, 새 영역이면 본 섹션에 추가)

### 비즈니스/문제 정의 (problem-core 영역)

없음. problem-core는 형식 정합 + Phase 0 종료 상태 반영만 수행하여 신규 미결정 없음.

### Use Case (problem-usecase 영역)

- UC-8 댓글 수정/삭제 권한 모델
  - 무엇이 미결정인가: 본인만 수정/삭제 가능 vs 글 작성자도 댓글 삭제 가능 — 권한 모델
  - 왜 결정하지 못했는가: ADMIN 모더레이션은 Out-of-scope이지만 "글 작성자의 댓글 삭제권"은 도메인 정책 결정 필요. 현 시점 본인만 가정으로 UC-8 작성
  - 다음 액션: /mcpsi-solution Phase 1 application-arch.md에서 확정
  - 영향 범위: UC-8 권한 검증 로직, Comment 엔티티 권한 분기

- UC-9 답글 경로 설계
  - 무엇이 미결정인가: `/comments/:commentId/replies` vs `/posts/:postId/comments/:commentId/replies` — REST 자원 계층 경로 표현
  - 왜 결정하지 못했는가: 두 표현 모두 정합 가능. REST 표준(자원 hierarchy 깊이 vs flat 노출) 트레이드오프
  - 다음 액션: /mcpsi-solution Phase 1 application-arch.md REST 표준 정합 결정
  - 영향 범위: UC-9 트리거, Reply controller 라우팅, Swagger 경로 문서

- UC-1 *a-4 / DT-1 in-flight 처리 정책
  - 무엇이 미결정인가: Idempotency-Key 동일 키 in-flight 시 후속 요청 처리 — 대기(blocking poll) vs 409 즉시 응답
  - 왜 결정하지 못했는가: 두 정책 모두 정합. 클라이언트 UX(대기) vs 서버 자원 보호(409) 트레이드오프
  - 다음 액션: /mcpsi-solution Phase 1 application-arch.md Idempotency 미들웨어 설계 시 확정
  - 영향 범위: DT-1 R4 액션 본체, application-arch Idempotency 처리기, UC-1·UC-6·UC-8·UC-9 *a Extension 본문

- UC-2 3a-1 로그인 실패 카운트 임계값 / 잠금 시간
  - 무엇이 미결정인가: 임계값 N회 / 잠금 지속 시간 / 잠금 해제 트리거
  - 왜 결정하지 못했는가: Phase 1 #11 Rate Limit + 실패 카운트 도입 결정만 있고 세부 수치는 미정
  - 다음 액션: /mcpsi-solution Phase 1 security.md 또는 application-arch.md에서 확정
  - 영향 범위: UC-2 Extension 3a-1, STRIDE-1(brute-force) 완화 정량 임계

- UC-3 Known Issue (TP5 재설계 후 UC-3 재작성 트리거)
  - 무엇이 미결정인가: UC-3은 현 구현(payload.email → uid) 기준으로 작성. Phase 1 TP5 재설계(user_auth_provider + provider_subject) 후 UC-3 Main Success Scenario 재작성 필요
  - 왜 결정하지 못했는가: Phase 1 Solution 단계 user_auth_provider 스키마 확정이 선행 조건
  - 다음 액션: Phase 1 종료 시점 /mcpsi-problem-usecase 재호출 (TP5 구현 완료 후)
  - 영향 범위: UC-3 단계 3·5, INV-5·INV-12 폐기, INV-1 의미 갱신

### 도메인 의미 (problem-domain-spec 영역)

- DT-2 audit_log 탈취 의심 알림 액션 (R5)
  - 무엇이 미결정인가: DT-2 R5 (Refresh 검증 OK + DB 불일치) audit_log 알림 액션의 구체 구현 시점
  - 왜 결정하지 못했는가: audit_log 테이블은 Phase 2 observability.md §3.2에서 신설 예정. Phase 1 시점에는 알림 액션 누락 가능
  - 다음 액션: Phase 2 implementation 시점 재확인 + DT-2 R5 액션 활성화
  - 영향 범위: DT-2 R5 액션 본체, Phase 2 observability audit_log 연계

- Phase 1 Comment/Reply 신규 INV
  - 무엇이 미결정인가: Comment.postId 참조 무결성, Comment.userId 참조 무결성, Reply.commentId 참조 무결성, 계층 깊이 1단 제한 INV의 정형화
  - 왜 결정하지 못했는가: Phase 1 User Aggregate 재설계 후 entity 스키마 확정 필요
  - 다음 액션: Phase 1 종료 시점 /mcpsi-problem-domain-spec 재호출
  - 영향 범위: 신규 INV 4건, UC-8·UC-9 의미 보존 검증표 갱신

### NFR/QAS (problem-nfr 영역)

비활성. problem/overview.md NFR 활성 판정 결과(정량 NFR 부재, Phase 4 산정 정책)로 본 영역 미결정 없음.

### 보안/위협 (problem-threat 영역)

- JWT_SECRET / PK_SECRET_KEY 회전 정책
  - 무엇이 미결정인가: 시크릿 회전 주기, 회전 시 기존 토큰 grace period, 회전 자동화 도구 / 수동 절차
  - 왜 결정하지 못했는가: 학습 프로젝트 운영 환경 단순성 vs 운영 표준 사이 트레이드오프. 현 시점 단일 시크릿 운용
  - 다음 액션: /mcpsi-solution security.md 시크릿 관리 섹션에서 정책 명문화
  - 영향 범위: STRIDE-3(토큰 탈취) 완화 운영 정책, STRIDE-9(시크릿 노출) 완화 운영 정책

- 세션 명시 로그아웃 엔드포인트
  - 무엇이 미결정인가: 명시 로그아웃 시 RefreshToken 즉시 무효화 경로 (현 구현은 토큰 만료 대기 또는 Rotation 사이클로 자연 무효화). DELETE /users/auth/session 등 별도 엔드포인트 도입 여부
  - 왜 결정하지 못했는가: 학습 프로젝트 범위 내 우선순위 판단 필요. 즉시 무효화는 STRIDE-3 완화 가치 있음
  - 다음 액션: /mcpsi-solution Phase 1 application-arch.md (신규 엔드포인트 도입 결정)
  - 영향 범위: STRIDE-3(토큰 탈취) 세션 무효화 경로, UserAuth.refreshToken 명시 NULL 처리 로직

### 후속 확인 액션 (Problem 단계 추가분)

| 항목 | 담당 | 시점 | 영향 범위 |
|------|------|------|----------|
| UC-8 댓글 수정/삭제 권한 모델 | 본인 | /mcpsi-solution Phase 1 application-arch.md | UC-8 권한 분기, Comment 엔티티 |
| UC-9 답글 경로 설계 | 본인 | /mcpsi-solution Phase 1 application-arch.md | UC-9 트리거, REST 표준 |
| Idempotency-Key in-flight 정책 (UC-1 *a-4 / DT-1) | 본인 | /mcpsi-solution Phase 1 application-arch.md | DT-1 R4, 4개 UC *a Extension |
| 로그인 실패 카운트 임계값/잠금 시간 (UC-2) | 본인 | /mcpsi-solution Phase 1 security.md | UC-2 3a-1, STRIDE-1 완화 정량 |
| UC-3 TP5 재설계 후 재작성 | 본인 | Phase 1 종료 시점 /mcpsi-problem-usecase | UC-3, INV-5·INV-12 폐기 |
| DT-2 audit_log 알림 액션 활성 | 본인 | Phase 2 implementation 시점 | DT-2 R5, audit_log 연계 |
| Phase 1 Comment/Reply 신규 INV | 본인 | Phase 1 종료 시점 /mcpsi-problem-domain-spec | 신규 INV 4건 |
| JWT_SECRET / PK_SECRET_KEY 회전 정책 | 본인 | /mcpsi-solution security.md | STRIDE-3·STRIDE-9 완화 |
| 세션 명시 로그아웃 엔드포인트 | 본인 | /mcpsi-solution Phase 1 application-arch.md | STRIDE-3, RefreshToken 즉시 무효화 |

## Sources

- docs/meeting-logs/2026-04-24.md §미결정 1, 2, 3, 4 (Phase 0 closure로 1·2·일부 해소)
- docs/meeting-logs/2026-05-11.md §결정 1 (Phase 0 종료에 따라 해소된 항목 제거 근거)
- docs/meeting-logs/2026-06-04.md §결정 5·6 (#34 타인 프로필 조회 / #38 Redis 자료구조 미유입 백로그 등록 근거)
- mcpsi-context 서브 스킬(core/domain/constraints) 반환 Unknowns 후보 통합
- mcpsi-problem 서브 스킬(core/usecase/domain-spec/threat) 반환 Unknowns 후보 통합 (2026-05-12)
- 백업: .claude/migrations/abundant-nibbling-toast-S-2/backup/docs/context.md §알려진 불확실성 (이력 보존)
