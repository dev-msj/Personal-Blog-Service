# Traceability Matrix

MCPSI 단계 횡단 8단 추적 매트릭스. mcpsi-traceability 단일 primary가 작성·갱신한다. 다른 스킬은 read-only 참조.

형식 사양: ~/.claude/skills/mcpsi-traceability/references/traceability-format.md
소유권: ~/.claude/skills/mcpsi-traceability/references/meta-folder-structure.md §2.4

마지막 갱신: 2026-05-12 (Implementation 단계 Phase 1 진입 — implementation-guide.md / testing-strategy.md / flows 12개 + 이슈 22개 신규 생성 + #61/#69/#70/#73 흡수 4건 Phase 1 마일스톤 이관 + issue-plan.md Phase 1 재설계. mcpsi-implementation-verify 4축 통과 후 자동 갱신)
방법론 근거: IEEE 29148:2018 §7.6 / IEEE 830:1998 §4.3.8 / MADR 4.0

현 상태: Implementation 단계 Phase 1 진입. docs/implementation/flows/ 12개 작성(user-register/login/oauth-login/token-refresh/blog-post-{write,read-detail,list}/post-like-toggle/comment-write/reply-write/comment-list-read/idempotency-key-handle). testing-strategy.md Pyramid 7종 [확정] 표 도입(단위 15 / 통합 25 / 계약 8 / E2E 40 / 성능 N/A / 보안 9 / 카오스 N/A — 총 97 TC). Phase 1 이슈 22개(#117~#136) + 흡수 4건(#61/#69/#70/#73) 등재. issue-plan.md `pyramid-tracking` 메타 라인 동기화 완료. Phase 2/3/4/5 영역은 단계 미진행 사유 유지.

본 매트릭스는 컬럼 9개로 운용 (다이어그램 컬럼이 S-4b runtime-behavior 활성화로 도입됨).

## 매트릭스

| RT ID | Stakeholder Req | FR/NFR/QAS | ADR | 모듈 | API/Event | 다이어그램 (SEQ/STM/SAGA) | 테스트 | 운영 메트릭 | 상태 |
|-------|-----------------|------------|-----|------|-----------|---------------------------|--------|-------------|------|
| RT-0001 | R-1 개발자 - 백엔드 비동기/관측성/부하 테스트 학습 사이클 완수 (context/overview.md §사업 목표 1~4) | BP1, BP2, BP4, BP6 \| TP1, TP2, TP6, TP8 (인프라/cross-cutting 영역. 직접 UC 매핑 없음 — problem/use-cases.md "BP2/4/5/6 직접 UC 매핑 없음" 참조). NFR 비활성 (Phase 4 산정 정책) | ADR-0004 (EDA, Phase 3), ADR-0005 (Outbox), ADR-0006 (BullMQ+Kafka), ADR-0008 (Correlation ID, Phase 2), ADR-0009 (LGTM 스택, Phase 2), ADR-0011 (k6+Prometheus, Phase 4), ADR-0012 (argon2id, Phase 5), ADR-0013 (AES-GCM, Phase 5), ADR-0014 (RFC 9457, Phase 5). ML-20260424-1 (MCPSI 신규 수립), ML-20260511-2 (Phase 1 진입) | (Solution 단계 미진행 부분: observability/ 모듈 신설 — Phase 2, notification/ 모듈 신설 — Phase 3, outbox relay worker — Phase 3. common/application-arch.md §모듈 구조 (최종 형상)에 등재 완료) | (Solution 단계 미진행 부분: Phase 2 /metrics 엔드포인트 신설, Phase 3 Kafka post.events/user.events 토픽 + BullMQ notification 큐, Phase 3 outbox INSERT 이벤트 envelope) | SEQ-1 (UC-5 hits 비동기), SEQ-2 (UC-6 좋아요 캐시), SEQ-4a (Comment 동기 트랜잭션 + outbox INSERT — Phase 3 시점), SEQ-4b (Phase 3 비동기 알림 발송 — outbox→Kafka→BullMQ), STM-Notification, STM-Outbox — 모두 common/runtime-behavior.md §3·§4 (Phase 3 활성화 흐름) | (Implementation 미진행: testing-strategy 재실행 대기) | (Observability 미진행: Phase 2 Correlation ID / RED+USE 메트릭 / SLO / Tempo 트레이싱 도입 예정. SLI 인벤토리는 common/observability.md §2.4 [확정], SLO 수치는 [가이드] 보류) | tracked |
| RT-0002 | R-2 개발자 - 기능 완성도 + 리팩토링 페어링 (댓글/답글/Idempotency-Key/User Aggregate 재설계) | BP3 \| TP3 (댓글/답글/Idempotency), TP4 (커서 페이징), TP5 (User 식별자 재설계) \| UC-7 (Phase 1 커서 전환), UC-8 (댓글 신설), UC-9 (답글 신설) \| DT-1 (Idempotency-Key, UC-1·6·8·9 *a Extension) \| INV-AP1 / INV-Cmt1·Cmt2 / INV-Rpl1·Rpl2 (Phase 1 신규 — implementation-guide.md §2 사후 정형화 대기) | ADR-0003 (Identity Separation), ADR-0007 (Idempotency Key, API 수신 측), ADR-0010 (Adjacency List), ADR-0015 (User Aggregate Refactoring Towards Patterns). Cursor-based Pagination [가이드]는 _index 대기 (정식 ADR 보류). ML-20260511-2 (Phase 1 진입 시 범위 유지) | user/ 모듈 재편 (UserEntity 신설 #117/X1, UserAuthEntity user_id BIGINT #118/X2, UserInfoEntity user_id BIGINT #119/X3, UserAuthProvider 신설 #120/X4), blog/ 모듈 확장 (Post 외래키 + IDOR #121/Y1, PostLike 외래키 + IDOR + 예외 컨텍스트 #122/Y2, Post 커서 페이징 + CursorPaginationDto #123/Y3, comment/reply 테이블 #124/Z1, Comment 모듈 신설 #125/Z2, Reply 모듈 신설 #126/Z3, Comment/Reply 조회 페이징 #127/Z4), idempotency/ 모듈 신설 (IdempotencyKeyInterceptor #132/T1), src/utils/cursor.utility (Y3에 포함), src/utils/nickname.utility (#131/U4) — common/application-arch.md §모듈 구조 + phase-1/arch-increment.md + issue-plan.md Phase 1 | Phase 1 신규 엔드포인트: `POST /posts/:postId/comments` `PATCH/DELETE /posts/comments/:commentId` `POST /posts/comments/:commentId/replies` `PATCH/DELETE /posts/comments/:commentId/replies/:replyId` `GET /posts/:postId/comments` (cursor) `GET /posts/comments/:commentId/replies` (전체) + `POST /users/auth/oauth` 재작성 (Account Linking, #131/U4) + Idempotency-Key 헤더 cross-cutting Interceptor (#132/T1). 커서 페이징 cursor 쿼리 파라미터 표준 도입 (Y3, Z4). Phase 1 이벤트 발행은 미수행 (Phase 3 위임) — phase-1/async-deployment.md §Comment/Reply 이벤트 발행 준비 | SEQ-3 (OAuth Account Linking, Phase 1 핵심) — flow user-oauth-login에 instantiation (docs/implementation/flows/user-oauth-login.md). SEQ-4a 의 Phase 1 부분(comment INSERT까지) — flow comment-write에 instantiation. flow 12개 추가: user-register / user-login / user-oauth-login / user-token-refresh / blog-post-write / blog-post-read-detail / blog-post-list / post-like-toggle / comment-write / reply-write / comment-list-read / idempotency-key-handle. flow ↔ runtime-behavior 매핑은 implementation-guide.md §1 Flow 인덱스 | testing-strategy.md TC 97개: TC-01~06 (user-register, UC-1+Extensions, E2E 4 / 단위 1 / 통합 1 / 보안 1), TC-07~12 (user-login, UC-2+Extensions, E2E 4 / 통합 1 / 보안 2), TC-13~20 (user-token-refresh, UC-4+Extensions, E2E 5 / 통합 2 / 단위 1), TC-21~28 (user-oauth-login, UC-3+Extensions, E2E 3 / 단위 1 / 통합 2 / 보안 1), TC-29~39 (blog-post-write, E2E 7 / 통합 2 / 보안 1 / 단위 PBT 1), TC-40~44 (blog-post-read-detail, UC-5, E2E 3 / 통합/PBT 2), TC-45~53 (blog-post-list, UC-7, E2E 6 / 통합 2 / 단위 PBT 1), TC-54~62 (post-like-toggle, UC-6, E2E 5 / 통합/PBT 3 / 보안 1), TC-63~72 (comment-write, UC-8+수정/삭제, E2E 7 / 통합 1 / 보안 1 / 단위 1), TC-73~81 (reply-write, UC-9+수정/삭제, E2E 6 / 통합 1 / 보안 1 / 단위 1), TC-82~89 (comment-list-read, E2E 6 / 통합 2), TC-IDEM-01~08 (idempotency-key-handle, DT-1 4분기, 통합 4 / 단위 3 / PBT 1). Pyramid 7종 [확정]: 단위 15 / 통합 25 / 계약 8 / E2E 40 / 성능 N/A / 보안 9 / 카오스 N/A. issue-plan.md `pyramid-tracking` 메타 동기화 완료. 입력 산출물 ID 매핑: 단위 ↔ M-N (모듈) / 통합 ↔ M-N↔M-M / 계약 ↔ API + DT-1 / E2E ↔ UC-N + flow-id / 보안 ↔ STRIDE-1·4·6·7·9·10·11 + security.md §2.2/§5/§7 | (Phase 1 직접 운영 메트릭 없음. Phase 2 진입 시 비즈니스 메트릭 `comments_created_total` / `posts_viewed_total` 등 수집 — common/observability.md §2.2) | tracked |
| RT-0003 | R-3 개발자 - 결정 근거 문서화 (MCPSI 파이프라인 운영 + 1차/2차 리뷰 + 영역 정합 게이트) | 메타 영역. BP/TP/UC/DT/INV 직접 매핑 없음. MCPSI 파이프라인 자체가 본 요구의 산출물 | ML-20260424-1 (MCPSI 수립), ML-20260429-1 (problem/solution 재작성 정책), ML-20260429-2 (Phase 0 운영정의 역승격), ML-20260429-3 (Phase 5 의도 명문화), ML-20260511-3 (전 단계 재실행). 정식 ADR 매핑 없음 — 본 행은 파이프라인 메타 정합 추적용 | (메타 영역 - 모듈 N/A) | (메타 영역 - API/Event N/A) | (메타 영역 - 다이어그램 N/A) | (Implementation 미진행: testing-strategy 재실행 대기) | (Observability 미진행) | tracked |
| RT-0004 | R-4 외부 독자(잠재) - 재현 가능 가이드 (Type A/B 블로그 산출) | 산출물 영역. BP/TP/UC/DT/INV 직접 매핑 없음 (블로그는 MCPSI 산출 정합 검증 대상이며 요구 분해 대상 아님). Phase 1 블로그 주제 후보는 implementation-guide §Phase 산출 문서 재실행 시 결정 | ML-20260424-3 (블로그 MCPSI 통합 관리), ML-20260424-4 (Type A/B 분리), ML-20260424-5 (주제별 독립 판단), ML-20260424-6 (CLAUDE.md 블로그 규칙), ML-20260424-7 (token-validation-strategies 이동), ML-20260511-5 (Phase 0 블로그 종결) | (Solution 미진행: implementation-guide §Phase 산출 문서 재실행 대기) | (산출물 영역 - API/Event N/A) | (산출물 영역 - 다이어그램 N/A) | docs/tech-notes/ (token-validation-strategies / design-doc-as-code-mcpsi / issue-plan-monotrack 3종 Phase 0 완료) | (블로그 산출 영역 - 운영 메트릭 N/A) | tracked |
| RT-0005 | R-5 1차 사용자(가상) - 인증된 사용자의 블로그 CRUD + 좋아요 (+Phase 1 댓글/답글) | UC-1 ~ UC-9 (9개 전체) \| DT-1 (Idempotency-Key, POST 계열 공통), DT-2 (토큰 이중 검증, 보호 엔드포인트 진입) \| INV-1 ~ INV-12 (User Aggregate 5 + Post/PostLike 4 + 인증/인가 3. INV-5·12는 Phase 1 TP5 후 deprecated) \| STRIDE 슬라이스: STRIDE-1~11 (Spoofing 3 / Tampering 2 / Repudiation 1 / Info Disclosure 3 / DoS 1 / EoP 1) — ASSET-1~8, ATTACK-SURFACE-1~7. OWASP Top 10 2021 매핑 완료 | ADR-0001 (단일 BC), ADR-0002 (JWT 이중 검증), ADR-0003 (Identity Separation, Phase 1), ADR-0007 (Idempotency Key), ADR-0008 (Correlation ID, Phase 2 적용), ADR-0010 (Adjacency List), ADR-0015 (User Aggregate 재설계). STRIDE-1~11 매핑은 common/security.md §9 Threat Mitigation 매트릭스로 1:1 커버 완료. ML-20260424-7 (JWT 이중 검증 baseline 명문화), Phase 0 #75~#89 closure 사실 (constraints.md §Phase 0 해소 공백) | auth/ AuthGuard sub BIGINT + verifyRefreshToken throw 통일 (#128/U1, #70 본체 흡수). user/ User Aggregate 재편 (#117~#120 X1~X4) + user-auth.service 재작성 (#129/U2 join·login, #130/U3 refresh QueryRunner, #131/U4 oauth Account Linking). blog/ Post 외래키 + IDOR (#121/Y1), PostLike 외래키 + IDOR + 예외 컨텍스트 (#122/Y2, #73 본체 흡수), Comment 모듈 (#125/Z2), Reply 모듈 (#126/Z3). 보안 인프라: app.module ThrottlerGuard 전역 (#133/V1), 경로별 @Throttle() (#134/V2), 로그인 실패 카운트 (#135/V3). cross-cutting: IdempotencyKeyInterceptor 전역 (#132/T1) — common/application-arch.md §모듈 구조 + phase-1/arch-increment.md | Phase 1 신규/재작성 엔드포인트 (issue-plan.md Phase 1 + arch-increment.md §엔드포인트 신설 정합): `POST /users/auth/oauth` (재작성 #131/U4), `POST/PATCH/DELETE /posts/:postId/comments[/:commentId]` (#125/Z2), `POST/PATCH/DELETE /posts/comments/:commentId/replies[/:replyId]` (#126/Z3), `GET /posts/:postId/comments` (cursor, #127/Z4), `GET /posts/comments/:commentId/replies` (#127/Z4). 기존 16개 엔드포인트는 사용자 식별자 user_id BIGINT 전환 (#121/Y1 PATCH·DELETE /posts/:postId, #122/Y2 POST·DELETE /posts/:postId/likes), Idempotency-Key 헤더 자동 적용 (#132/T1, @SkipIdempotency() 부착 login/refresh/oauth/GET 제외) | SEQ-3 (OAuth Account Linking, RT-0002와 공유) ↔ flow user-oauth-login instantiation. SEQ-1·SEQ-2 (Phase 3 활성화 시 R-5 직접 경험) ↔ flow blog-post-read-detail / post-like-toggle Phase 1 부분 instantiation. SEQ-4a Phase 1 부분 ↔ flow comment-write instantiation. SEQ-4b는 Phase 3 활성 시점. 추가 인증 흐름: phase-1/runtime-deployment.md §1.1 AuthGuard 다이어그램 ↔ flow user-token-refresh + AuthGuard cross-cutting TC | testing-strategy.md TC 97개 (RT-0002와 공유 — TC-01~89 + TC-IDEM-01~08). AuthGuard cross-cutting TC-94~96 (DT-2 R1·R3·R6). 보안 카테고리 9 TC: TC-11 (로그인 잠금 STRIDE-1), TC-12 (Throttler login STRIDE-1·10), TC-28 (Throttler oauth), TC-34 (Post IDOR STRIDE-4·11), TC-38 (Throttler Write STRIDE-10), TC-62 (PostLike IDOR STRIDE-4), TC-68 (Comment IDOR), TC-78 (Reply IDOR), TC-92 (RuleBasedStateMachine PBT 카운터), TC-93 (PII 비노출 STRIDE-7). W1(#136) IDOR E2E 통합 회귀로 STRIDE-4/STRIDE-11 cross-cutting 회귀 보장 | (Observability 미진행: Correlation ID/구조화 로깅 Phase 2 도입 예정. DT-2 R5 audit_log 알림은 Phase 2 implementation 시점 활성. Phase 1 임시로 Winston 구조화 로그 event=auth.token.invalid_refresh / auth.login.failure_locked 기록 — common/observability.md §5.2 마이그레이션 후보) | tracked |

## 끊긴 링크

broken 행 0개. 모든 행이 6단 이상(Stakeholder Req + FR/NFR/QAS + ADR/ML + 빈 컬럼 사유 명시) 채움으로 tracked 유지.

Solution 단계 완료 후 자연 진행 상태:
- RT-0001/0002/0005가 ADR 컬럼에 정식 ADR-NNNN 매핑됨 (이전 ML-* 임시 → ADR-0001~0015 정식 부여)
- 다이어그램 컬럼이 SEQ-1/2/3/4a/4b / STM-Notification / STM-Outbox 7건으로 채움 (S-4b runtime-behavior 활성화 + 다이어그램 가독성 보정으로 SEQ-4 → SEQ-4a/SEQ-4b 분할)
- RT-0001 모듈 컬럼 → common/application-arch.md §모듈 구조 (최종 형상) 등재 부분 명시. Phase 2/3 신설 부분은 단계 미진행 사유로 분리 기록
- RT-0002 모듈/API/Event 컬럼 → Phase 1 신규 (Comment/Reply CRUD + Idempotency-Key + 커서 페이징) 채움. Implementation 미진행으로 테스트 컬럼은 사유 명시 유지
- RT-0003/0004는 직접 매핑 없음 — 메타/산출물 영역 사유 명시 유지

후속 단계 verify 통과 시 점진 채움:
- /mcpsi-implementation-verify 통과 → 테스트 케이스 TC-N 컬럼
- observability 산출물 작성 (Phase 2) → 운영 메트릭/SLO 컬럼
- ADR-0001~0015 정식 MADR 4.0 파일 작성 (현재는 _index만 등록). 트리거: (a) /mcpsi-traceability 사용자 명시 호출로 _index 일괄 추출 작성, (b) 후속 변경 발생 시 결정 주체 스킬(mcpsi-solution-*)이 [확정] 부여와 동시에 정식 파일 작성, (c) /mcpsi-traceability 변경 임팩트 매트릭스 진입 시 ADR 작성 셀에서 자연 트리거

## 고아 산출물

- ADR: ADR-0001~0015 _index 등록 완료 (Solution-verify 2차 통과 + warn 보정 일괄 부여, 2026-05-12). 15건 모두 RT-0001/0002/0005에 매핑되어 고아 ADR 0건. 정식 MADR 4.0 파일 작성은 mcpsi-traceability primary 책임 (description 확장 — docs/meta/* 단일 운영자 + ADR 라이프사이클). Cursor-based Pagination [가이드] 1건 + Load Testing Methodology 1건은 _index 대기 항목 (정식 ADR 보류) → 고아 아님
- 모듈: common/application-arch.md §모듈 구조 (최종 형상) 등재 모듈(auth, user, blog, observability, notification, health, config, constant, decorator, filter, interceptor, pipe, exception, response, utils, redis)이 RT-0005(R-5 핵심 도메인 모듈) 또는 RT-0001/0002(인프라/Phase 신설 모듈)에 분산 매핑됨 → 고아 모듈 0건
- 다이어그램: SEQ-1, SEQ-2, SEQ-3, SEQ-4a, SEQ-4b, STM-Notification, STM-Outbox 7건 모두 RT-0001 또는 RT-0002 또는 RT-0005에 매핑됨 → 고아 다이어그램 0건. SEQ-4 → SEQ-4a/SEQ-4b 분할은 의미적으로는 단일 흐름(댓글 작성 → 알림)의 동기/비동기 구간 시각적 분리이며 매핑 대상 UC(use-cases.md Phase 1 신규 UC-8) 변경 없음
- 테스트: 현 E2E 4종(user-auth, post, app, health)은 Phase 0 baseline. testing-strategy 재실행 시 TC-N 부여 + RT-0005와 연결 예정 → 미진행 영역 (검사 대상 아님)
- BP/TP/UC/DT/INV/STRIDE 자체의 고아 검사:
  - BP1·BP2·BP4·BP6 → RT-0001 매핑 (인프라/cross-cutting)
  - BP3 → RT-0002 매핑 (기능)
  - BP5 → Phase 0 closure로 RT-0005 ADR 컬럼에 closure 사실 반영 (직접 BP 매핑 행 없음 — 기반 확보는 Phase 0 종료로 자연 해소)
  - TP1~TP8 → RT-0001(TP1·2·6·8) / RT-0002(TP3·4·5) / Phase 0 closure(TP7) 분산. TP7만 BP5와 같이 closure로 해소되어 직접 매핑 행 없음 — 고아 아님 (closure 영역)
  - UC-1~UC-9 → RT-0005 매핑
  - DT-1 → RT-0002·RT-0005 매핑
  - DT-2 → RT-0005 매핑
  - INV-1~INV-12 → RT-0005 매핑
  - STRIDE-1~STRIDE-11 → RT-0005 매핑 (common/security.md §9 매트릭스 1:1 커버)
  - 고아 없음

## 갱신 이력

| 일시 | 갱신 트리거 | 신규 행 | 갱신 행 | broken 변동 |
|------|--------------|---------|---------|-------------|
| 2026-05-11 | docs/meta/ 폴더 신설 (S-6 verify 권고) | 0 | 0 | 0 |
| 2026-05-11 | /mcpsi-traceability 단독 호출 (Context 단계 산출물 → 초기 5행 추출) | 5 | 0 | 0 (모두 tracked) |
| 2026-05-12 | /mcpsi-traceability 단독 호출 (Problem 단계 신정책 정합 완료 후속 — FR/NFR/QAS 컬럼 BP/TP/UC/DT/INV/STRIDE로 채움) | 0 | 5 | 0 (모두 tracked 유지) |
| 2026-05-12 | /mcpsi-traceability 단독 호출 (Solution-verify 2차 통과 + warn 보정 4건 — ADR-0001~0015 _index 등록, STRIDE 매트릭스 추가, runtime-behavior.md 신설, 기각 대안 보강. ADR 컬럼 정식 ADR-NNNN 부여, 다이어그램 컬럼 신설 SEQ-1~4 / STM-Notification·Outbox 채움, 모듈/API/Event 컬럼 Phase 1·Phase 2·Phase 3 신설 부분 분리 기록) | 0 | 5 | 0 (모두 tracked 유지) |
| 2026-05-12 | /mcpsi-traceability 단독 호출 (Solution-verify 3차 통과 + 다이어그램 가독성 보정 — SEQ-2/3 + phase-1 §1.1 alt deactivate 패턴 정정, SEQ-1/2 라벨 줄바꿈, SEQ-4 → SEQ-4a/SEQ-4b 분할 + payload Note 분리, STM-1/2 라벨·노트 단축, security.md §1 MFA / §4 전송 중 암호화 / §4 비밀번호 저장 / data-design.md §RDB 엔진 4 Minor 보정 적용. 결정 의미 변경 없음, 다이어그램 ID 1건만 변경(SEQ-4 → SEQ-4a/4b)) | 0 | 3 (RT-0001/0002/0005 다이어그램 컬럼) | 0 (모두 tracked 유지) |
| 2026-05-12 | /mcpsi-traceability 단독 호출 (트리거 문구 정정 — mcpsi-updator §4.7/§4.8 → mcpsi-traceability 책임 이관 사실 반영. L39/L43/L85 "mcpsi-updator §4.7 매트릭스" 표현을 "mcpsi-traceability primary 책임 + 트리거 (a)/(b)/(c)"로 정정. 매트릭스 데이터(RT-0001~0005) 변경 없음, 메타 표현 정합성만 보강) | 0 | 0 (메타 표현 정정 — 매트릭스 행 변경 없음) | 0 (모두 tracked 유지) |
| 2026-05-12 | /mcpsi-traceability 검증 → 갱신 (메타 정합성 warn 3건 보정 — adr/_index.md L3 primary "mcpsi-updator 단일 primary" → "mcpsi-traceability 단일 primary", L28/L33/L40 "mcpsi-updator 4.7" → "mcpsi-traceability 변경 임팩트 매트릭스" 표현 정정, change-impact-log.md L3 primary 표기 + L5 형식 사양 경로 mcpsi-updator → mcpsi-traceability 이관 반영. references/methodology-change-impact.md 실제 위치 확인 후 적용. 매트릭스 데이터 변경 없음) | 0 | 0 (메타 표현 정정 — 매트릭스 행 변경 없음) | 0 (모두 tracked 유지) |
| 2026-05-12 | /mcpsi-traceability ADR 라이프사이클 "신규 발행" 모드 (정식 MADR 4.0 본문 일괄 작성 — ADR-0001~0015 15건. Title / Status / Context and Problem Statement / Considered Options / Decision Outcome / Consequences / Links 7섹션 형식. Source: common/overview.md, application-arch.md, data-design.md, async.md, security.md, observability.md, phase-1/data-migration.md. _index.md L7 마지막 갱신 + L33 정책 텍스트 + Phase 5 supersede 예정 문구 일괄 정정. 매트릭스 ADR 컬럼은 기존 _index 매핑 유지 — 신규 행 0, 갱신 행 0) | 0 | 0 (ADR 본문 작성 — 매트릭스 행 변경 없음) | 0 (모두 tracked 유지) |
| 2026-05-12 | /mcpsi-implementation 완료 + /mcpsi-implementation-verify 4축 통과 후 /mcpsi-traceability 단독 호출 — Implementation 단계 Phase 1 진입 반영. docs/implementation/flows/ 12개 신설, implementation-guide.md / testing-strategy.md Phase 1 재작성, issue-plan.md Phase 1 재설계(2026-05-12 21건 초안 → 22건 재설계로 빌드 일관성·크기 가이드 충족), 신규 이슈 22개 #117~#136 생성 + 흡수 4건(#61/#69/#70/#73) 이관. RT-0002·RT-0005 모듈/API/Event/다이어그램/테스트 컬럼 Phase 1 진행분 일괄 채움. Pyramid 7종 [확정] 표 도입(97 TC) + flow ↔ TC ↔ runtime SEQ 양방향 정합. RT-0001/0003/0004는 Phase 1 실행 범위 외 — Phase 2/3 영역은 단계 미진행 사유 유지. RT-0004 블로그 주제는 implementation-guide.md §Phase 산출 문서 섹션이 본 mcpsi-implementation 사이클에서 미작성 — 사용자 의식적 보류(후속 결정 또는 PR 사이클 도출) | 0 | 2 (RT-0002, RT-0005 모듈/API/Event/다이어그램/테스트 컬럼 채움) | 0 (모두 tracked 유지 — 단계 미진행 사유 명시) |

## Sources

이번 갱신에 읽은 단계 산출물:
- docs/context/{overview,domain,constraints,unknowns}.md (last modified: 2026-05-11~12)
- docs/problem/{overview,use-cases,domain-spec,threat-model}.md (2026-05-11~12)
- docs/solution/common/{overview,application-arch,data-design,async,security,observability,runtime-behavior}.md (2026-05-12)
- docs/solution/phase-1/{scope,arch-increment,data-migration,async-deployment,security-deployment,observability-deployment,runtime-deployment}.md (2026-05-12)
- docs/implementation/{implementation-guide,testing-strategy,issue-plan}.md (2026-05-12 신규 작성/재설계)
- docs/implementation/flows/*.md 12개 (2026-05-12 신규 작성)
- docs/meeting-logs/2026-04-24.md, 2026-04-29.md, 2026-05-11.md
- docs/meta/adr/_index.md (ADR-0001~0015 Accepted 등록)
- docs/meta/change-impact-log.md
- GitHub Issues: 신규 #117~#136 (22건, Phase 1 마일스톤) + 흡수 #61/#69/#70/#73 (4건)

갱신 트리거: /mcpsi-implementation 완료 + /mcpsi-implementation-verify 4축 통과 후 /mcpsi-traceability 사용자 명시 호출. mcpsi-implementation-verify 검증 4(흐름 매핑 정합) + 축 4 Traceability 갱신 권고 처리. issue-plan.md `pyramid-tracking` 메타 ↔ testing-strategy.md "Test Pyramid 비율 (7종)" 표 ↔ RT-0002 테스트 컬럼 3축 동기화 완료(unit:15 / integration:25 / contract:8 / e2e:40 / performance:n/a / security:9 / chaos:n/a).

다음 갱신 트리거 후보:
- Phase 1 첫 PR 리뷰 사이클 → work-review B15-2 → plan-manager 호출로 이슈 closed 표시 + 이관 이슈 발생 시 본 매트릭스 영향 검토
- Phase 1 완료 후 mcpsi-meeting-log → Phase 2 진입 결정 → mcpsi-implementation N차 호출 → 본 매트릭스 Phase 2 영역 채움 (observability 모듈, Correlation ID Interceptor, audit_log 등)
- RT-0004 블로그 주제 선언 (Type A 설계 시점) — implementation-guide.md §Phase 산출 문서 섹션 추가 후 issue-plan.md narrative 이슈 등록 시 본 매트릭스 RT-0004 산출물 컬럼 채움
- ADR supersede 발생 (Phase 5 진입 시점 — ADR-0012 argon2id가 SHA256 baseline supersede, ADR-0013 AES-GCM이 AES-ECB supersede, ADR-0014 RFC 9457이 HTTP 200+FailureResponse 컨벤션 supersede)
- 신규 [확정] 결정 발생 — 결정 주체 스킬이 _index 등록 + 정식 ADR-NNNN.md 본문 작성을 한 트랜잭션으로 수행
