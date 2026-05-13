---
migrated: abundant-nibbling-toast-S-2
---

# Context — Overview

비즈니스 맥락·이해관계자·시간 제약·참고 서비스. 도메인 모델(UL/BC/Context Map)은 domain.md, 기술 제약·코드 상태는 constraints.md, 미결정 사항은 unknowns.md.

## 비즈니스 맥락

이 프로젝트는 백엔드 개발 역량 성장을 위한 개인 학습/연구 프로젝트다. 단순 CRUD API 구축을 넘어 비동기 시스템(cache, queue, Kafka 등)을 적용하고 부하 테스트를 통해 백엔드 서버의 비동기 성능을 튜닝하는 경험을 쌓는 것이 장기 목표다.

"동작하는 API" 자체가 산출물이 아니라 "기술적 결정의 근거와 측정 가능한 검증 사이클"이 산출물이다. 아키텍처와 기술 결정을 문서로 관리하며 체계적으로 발전시키는 것이 핵심 가치이며, MCPSI 파이프라인을 통한 근거 문서화가 프로젝트 운영 원칙이다.

### 사업 목표 및 성공 지표

학습 프로젝트의 특성상 수익 목표 대신 역량 성장 기준으로 정량화한다.

1. 비동기 기술 적용 체크리스트 (Phase별 달성 단위)
   - Redis 애플리케이션 캐시 계층 도입 완료
   - 작업 큐 도입 완료 (구체 기술은 Solution 단계에서 확정 — BullMQ 채택)
   - Kafka 이벤트 기반 비동기 처리 도입 완료
   - 각 기술 도입 판정 기준: MCPSI solution 문서 확정 + 구현 머지 + Type A(설계) 블로그 + Type B(회고) 블로그(측정 포함) 세트 완료

2. 기능 완성도 및 리팩토링 체크리스트
   - 현재 미구현 기능 완성 (댓글 #6, 답글 #7, 중복 요청 방지 캐시 #11 등)
   - 이후 적용할 비동기 기술 단계마다 기존 코드 리팩토링 계획 동반 수립 및 실행 (기능 추가와 구조 개선을 페어링)

3. 시스템 관측성 가시화 (백엔드 필수 지표로 편입)
   - 요청 ID 기반 구조화 로깅 연결 완료 (Correlation ID 전파)
   - 메트릭/트레이싱 계층 도입 (LGTM 스택 + OpenTelemetry, Phase 2에서 적용)
   - 운영 대시보드 구축 (병목 지점 및 설계 오류 탐지를 위한 가시화)
   - 근거: 관측성이 없으면 비동기화 성과를 측정할 수 없고 튜닝의 대상 지점도 확정 불가

4. 부하 테스트 기반 성능 검증 (수치 목표 미확정)
   - "베이스라인 측정 → 튜닝 → 재측정" 사이클 최소 1회 완수 (Phase 4 baseline → Phase 5 재측정)
   - 수치 목표(RPS, p99 latency, 동시 사용자)는 목표 규모 가정 확정 후 산정 (unknowns.md "기술/코드"로 승계)

5. Type A/B 블로그 편수는 성공 지표에서 제외
   - 근거: 편수 기반 목표는 계획 인플레이션을 유발. 주제별 품질 기준(CLAUDE.md "기술 블로그 문서화 규칙")을 만족한 문서가 산출되면 충분

### 수익 모델

해당 없음 (개인 학습/연구 프로젝트).

## 이해관계자

IEEE 42010 / arc42 §1.2 형식 — 역할 / 기대 / 우려·관심사.

- 개발자 1명 (사용자 본인 @dev-msj): 모든 역할 수행 (기획/설계/구현/테스트/운영). 기대: 백엔드 비동기/관측성/부하 테스트 학습 사이클 완수. 관심사: 결정 근거의 문서화, 추적 가능한 발전 이력
- 외부 독자 (잠재): Type A/B 블로그의 잠재 독자. 기대: 외부 공유 가치가 있는 결정의 근거와 회고. 관심사: 재현 가능한 가이드, 측정 수치 기반 결론
- 1차 사용자 (가상): 블로그 프론트엔드를 통한 글 작성·조회·좋아요. 본 서비스 범위 밖이나 API 요구사항의 추상 페르소나로 작동

의사결정 구조: 단일 의사결정자. 모든 기술/설계 결정을 사용자 본인이 수행. MCPSI 미팅 로그가 결정 이력의 단일 진실 소스.

대상 사용자 페르소나: "블로그 글을 작성·조회·좋아요하는 인증된 사용자". UserAuth 가입 또는 Google OAuth 로그인 경로로 진입.

## 시간 제약

- 데드라인: 없음 (학습 품질 우선)
- Phase별 목표 시점: 미설정. 시간 기반이 아닌 품질 기반으로 Phase 전환 판정 (Phase 0 종료 = 2026-05-11, Problem/Solution 게이트 충족 시점)
- 우선순위 방향성: 기능 완성(Phase 1) → 관측성 가시화(Phase 2) → 비동기화(Phase 3) → 부하 테스트(Phase 4) → 품질 개선·재측정(Phase 5). Phase 분리 근거는 docs/problem.md §Phase 근거

## 참고 서비스/벤치마크

특정 레퍼런스 서비스 없음. 업계 실무상 일반화된 기준을 최소 가이드라인으로 채택.

가이드라인 기준 (Solution 단계의 근거 후보):
- 인증: RFC 7519 JWT, RFC 6749 OAuth 2.0, OWASP Authentication Cheat Sheet
- 로깅: 12-Factor App XI (Logs as event streams), 구조화 로깅 일반 관행
- 관측성: CNCF Observability Standards, OpenTelemetry 사양 (Traces/Metrics/Logs)
- 캐싱: Cache-Aside / Read-Through / Write-Through 표준 패턴
- 비동기 메시징: Hohpe & Woolf "Enterprise Integration Patterns", Transactional Outbox, Richardson "Microservices Patterns" Saga
- 이벤트 스트리밍: Kafka 공식 문서, Kleppmann "Designing Data-Intensive Applications"
- 안정성: Nygard "Release It!" Stability Patterns (Timeout/Circuit Breaker/Bulkhead 등)
- API 표준화: RFC 9457 Problem Details (Phase 5 전환 예정)

## Sources

- docs/meeting-logs/2026-04-24.md §결정 1, 7 / §미결정 3, 4
- docs/meeting-logs/2026-04-29.md (Phase 의도 명문화)
- docs/meeting-logs/2026-05-11.md §결정 1, 5 (Phase 0 종료 선언, Phase 1 진입)
- 사용자 직접 진술 (학습 목표 정의, 단일 의사결정자)
- 백업: .claude/migrations/abundant-nibbling-toast-S-2/backup/docs/context.md
