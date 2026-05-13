# Phase 1 Scope

## 의도

기능 완성의 첫 마일스톤이자 도메인 재정비. Phase 1~3 누적이 곧 기능 완성을 구성한다. Phase 0에서 활성화된 migrations 인프라 위에서 User Aggregate 재설계의 데이터 보존형 마이그레이션을 작성하고, 댓글·답글 기능을 추가하며, 중복 요청 방지·커서 페이징·인증 강화를 도입한다.

## 대응 Problem

- BP3 기능 완성도 미흡: 댓글/답글 부재, 페이지네이션 한계, OAuth 사용자 식별 불완전
- TP3 중복 요청 방지 (Idempotency Key Pattern API 수신 측 적용, 댓글/답글 트랜잭션 안전)
- TP4 페이징 (offset → cursor 전환)
- TP5 User 식별자 재설계 (Identity Separation + Account Linking)
- 보안 강화: TP3·TP5 기반의 IDOR 방어 + Rate Limit + 로그인 실패 카운트 (security.md §2·§5·§7 적용 시점)

## 범위 내

1. **User Aggregate 재설계** (TP5)
   - user 테이블 신설 (BIGINT user_id)
   - user_auth 재구성 (uid VARCHAR → user_id BIGINT FK, login_id 컬럼 분리)
   - user_auth_provider 테이블 신설 (Google OAuth `sub` 클레임 매핑)
   - user_info 외래키 변경
   - post / post_like 외래키 전파 (post_uid → user_id)
   - OAuth 로그인 시 email 기반 기존 User 자동 연동
   - 절차 상세: data-migration.md

2. **댓글·답글 기능** (BP3)
   - comment 테이블 신설
   - reply 테이블 신설 (Adjacency List, 깊이 1단계)
   - CRUD API (POST/PATCH/DELETE) + 커서 페이징 조회
   - 절차 상세: arch-increment.md

3. **커서 페이징** (TP4)
   - Post 목록 조회: `(write_datetime DESC, post_id DESC)` 복합 키 커서
   - 사용자별 Post 조회: `idx_post_user` 활용
   - Comment 조회: `(post_id, created_datetime ASC, comment_id ASC)`
   - Reply 조회: comment 단위 전체 조회 (보통 N 작음)

4. **Idempotency-Key 헤더 API 수신 측 적용** (TP3)
   - 대상: 모든 Write API (POST/PATCH/DELETE) — 좋아요, 글/댓글/답글 작성·수정·삭제
   - Redis 키 `idempotency:{user_id}:{idempotency_key}` TTL 24h
   - 절차 상세: async-deployment.md

5. **보안 강화**
   - IDOR 방어 Service 레이어 소유권 확인 리팩토링 (모든 Write API)
   - `@nestjs/throttler` 전역 등록 + 경로별 제한 정책 (security.md §5 매핑)
   - 로그인 실패 카운트 (`login_fail:{loginId}` Redis 카운터 TTL 15분, 5회 잠금)
   - `COMMON_TOO_MANY_REQUESTS` ErrorCode 신설 (90xxx)
   - 절차 상세: security-deployment.md

## 범위 외 (Phase 위임)

- 비동기 본격 도입 (Outbox / Kafka / BullMQ / notification 모듈) — Phase 3
- observability/ 모듈 신설 (Correlation ID Interceptor, 감사 로그, Metrics, Tracing) — Phase 2
- argon2id / AES-GCM 전환 — Phase 5
- RFC 9457 Problem Details 응답 표준 — Phase 5
- 부하 테스트 시나리오 수립 — Phase 4

## 진입 게이트

Phase 1 진입 전 Phase 0 완료 필수:
- Node 22.x LTS 선언
- 불필요 의존성 정리
- TypeORM `synchronize: false` 전환 + InitialSchema 마이그레이션 export + E2E globalSetup runMigrations
- gitleaks pre-commit 훅
- Phase 0 PR 사이클에서 발견된 기반 결함 흡수

Phase 0 완료 상태에서만 Phase 1의 데이터 보존형 마이그레이션 작성이 안전하다.

## 종료 조건

- 위 5개 범위 내 항목 모두 머지
- E2E 테스트가 새 user/comment/reply 흐름을 검증 (인증 흐름 재작성 포함)
- 기존 API의 PK 응답 형식 유지 (PK 암호화는 Phase 5에 AES-GCM 전환)
- Phase 2 진입 전 plan-manager에 의해 발견된 결함 흡수 완료

## Sources

- ../common/overview.md §Phase 정의 (Phase 1)
- ../common/application-arch.md §3방향 리팩토링 결정 (Refactoring Towards Patterns)
- ../common/data-design.md §스키마 (최종 형상)
- ../common/security.md §2 인가 / §5 Rate Limiting / §7 침해 대응 알림
- docs/problem/overview.md §Phase 근거 §Phase 1
- docs/problem/use-cases.md (Phase 1 신규 UC: 댓글/답글)
