# Problem — Domain Spec

도메인 의미 명세 — Invariant·Decision Table·State Machine. Use Case는 use-cases.md, NFR은 nfr-qas.md(현 비활성), 위협 모델링은 threat-model.md.

본 문서의 INV-N은 Aggregate consistency boundary 내에서 모든 트랜잭션 종료 시 참이어야 하는 조건(Evans 2003 Ch.6). DT-N은 UC-N의 Extension에서 위임된 조건 조합 정형화 (ISTQB Foundation §4.2.3). 현 도메인은 명시적 상태 생명주기를 가진 Aggregate가 없어 SM은 비활성 (UML 2.5.1 §14 적용 대상 부재).

## 도메인 Invariant

### User Aggregate

- INV-1 [확정]: UserAuth.uid는 전역 유일하다. 침해 시 회원가입 트랜잭션 거부 (UserAlreadyExistsException). 적용 UC: UC-1
- INV-2 [확정]: UserInfo.nickname은 전역 유일하다 (UNIQUE 제약). 침해 시 UserInfo 생성/수정 트랜잭션 거부. 적용 UC: UserInfo 단순 CRUD (UC 분리되지 않음)
- INV-3 [확정]: UserAuth와 UserInfo는 1:1 관계이며 생명주기가 일치한다 (UserAuth 삭제 시 UserInfo CASCADE). 침해 시 참조 무결성 손상. 적용 UC: UC-1 (생성), 회원 탈퇴 흐름 (현재 UC 분리되지 않음)
- INV-4 [확정]: 비밀번호는 평문으로 저장되지 않는다. UserAuth.password는 salt + 해시 함수(현 SHA256 3회, Phase 5 argon2id) 결과만 저장한다. 침해 시 인증 보안 침해 (PII 노출). 적용 UC: UC-1, UC-2
- INV-5 [가이드]: Google OAuth 경로로 생성된 UserAuth는 socialYN='Y', 일반 경로는 'N'이다. **현 구현 한정 — Phase 1 TP5에서 UserAuthProvider 분리로 deprecated 예정 (provider_subject 기반 식별로 대체). 적용 UC: UC-3**

### Post / PostLike Aggregate

- INV-6 [확정]: Post의 작성자(postUid)와 수정/삭제 권한자는 동일한 식별자를 가진다. 침해 시 권한 위반 예외 (현 구현은 service 레이어 검증, ADMIN 차등 권한 없음). 적용 UC: Post 수정/삭제 (UC 분리되지 않음)
- INV-7 [확정]: Post.hits는 0 이상이며 상세 조회 시 단조 증가한다 (감소 불가). 침해 시 데이터 무결성 손상. 적용 UC: UC-5. **Phase 3에서 비동기 집계로 전환 시 단조 증가 보장은 eventual consistency 범위로 재정의 (Solution async-processing.md §Idempotency)**
- INV-8 [확정]: PostLike는 (postId, uid) 쌍당 최대 1건이다. 침해 시 INSERT 실패 (복합 PK 스키마 강제) → PostLikeAlreadyExistsException. 적용 UC: UC-6
- INV-9 [확정]: UserAuth 삭제 시 해당 사용자가 작성한 Post와 보유한 PostLike는 모두 CASCADE 삭제된다. Post 삭제 시 해당 Post에 연결된 PostLike도 CASCADE 삭제된다. 침해 시 참조 무결성 손상. 적용 UC: 회원 탈퇴 / Post 삭제 (UC 분리되지 않음)

### 인증/인가

- INV-10 [확정]: 인증 통과 조건은 AccessToken의 서명/만료 검증 통과 AND RefreshToken의 DB 저장값 일치가 동시에 성립하는 경우다. 둘 중 하나라도 실패 시 401. 침해 시 즉시 세션 무효화 불가. 적용 UC: 모든 보호 엔드포인트 (UC-5/6/7/8/9 진입 조건)
- INV-11 [확정]: 토큰 갱신 시 AccessToken과 RefreshToken은 함께 재발급되며 DB 저장값도 동시에 갱신된다 (Rotation 원자성 — 부분 성공 금지). 침해 시 replay 공격 방어 무력화. 적용 UC: UC-4
- INV-12 [가이드]: Google OAuth 로그인 시 기존 uid가 있으면 socialYN 값과 무관하게 로그인이 성공한다 (기존 계정과 OAuth 병용 허용). **현 구현 한정 — Phase 1 TP5에서 UserAuthProvider 신설 + provider_subject(OAuth sub) 기반 동일인 식별으로 재정비 예정. 적용 UC: UC-3**

### Phase 진화에 따른 Invariant 변경 예고

- Phase 1 (User Aggregate 재설계 — TP5):
  - INV-1 ~ INV-5의 "uid" 의미가 "UserAuthProvider.uid(인증 식별자)"로 이동하고, 내부 식별자 userId(BIGINT)가 새 PK로 도입됨
  - INV-5/INV-12 (socialYN) 폐기, UserAuthProvider.providerType = 'local' | 'google' 로 대체
  - 신규 INV: Comment.postId 참조 무결성, Reply.commentId 참조 무결성, 계층 깊이 1단 제한 (댓글 → 답글)
- Phase 3 (비동기 집계 전환 — TP1):
  - INV-7의 즉시성 약화 (eventually consistent — 이벤트 발행 후 집계 워커 처리 사이 일시 지연 허용. Solution async-processing.md 확정)
- Phase 5 (보안 표준 강화 — TP8):
  - INV-4의 해시 함수가 SHA256 3회 반복 → argon2id로 강화

## Decision Tables

### DT-1 [가이드]: Idempotency-Key 처리

연결: UC-1 Extension *a, UC-6(추가) Extension *a, UC-8 Extension *a, UC-9 Extension *a (POST 계열 멱등 처리 공통)

도메인 invariant가 아닌 cross-cutting 처리 분기. domain-spec에서 정형화한 결과는 Solution `application-arch.md` 인터셉터/미들웨어 설계 입력으로 활용. in-flight 처리 정책(대기 vs 409)은 Solution 단계 확정.

| Conditions                   | R1  | R2  | R3  | R4  |
| ---------------------------- | --- | --- | --- | --- |
| Idempotency-Key 헤더 제공    | N   | Y   | Y   | Y   |
| 캐시 상태                    | -   | miss | hit-stored | hit-in-flight |
| **Actions**                  |     |     |     |     |
| 일반 처리 진행 + 결과 캐시    | N   | Y   | N   | N   |
| 일반 처리 진행 (캐시 미사용)  | Y   | N   | N   | N   |
| 저장된 응답 즉시 반환         | N   | N   | Y   | N   |
| in-flight 처리 (대기 또는 409) | N   | N   | N   | Y   |

축약 근거: 캐시 상태 don't care는 키 미제공 시(R1)만 적용 — 키가 없으면 캐시 조회 자체가 발생하지 않음. 4 조건의 전체 조합 8개 중 의미 있는 4개 결과로 축약.

TTL 만료 처리: 캐시 상태 = miss와 동일하게 취급 (R2). TTL 자체는 캐시 백엔드 설정값으로 본 DT의 조건이 아님.

### DT-2 [확정]: 토큰 이중 검증

연결: 보호 엔드포인트 진입(전역 AuthGuard) + UC-4 토큰 갱신 흐름

AccessToken 서명/만료 검증과 RefreshToken DB 일치 검증의 4 조건 조합. INV-10·INV-11 침해 시점 식별 및 audit_log 알림 대상 분기에 사용.

| Conditions                    | R1  | R2  | R3  | R4  | R5  | R6  |
| ----------------------------- | --- | --- | --- | --- | --- | --- |
| AccessToken 서명/만료 OK      | Y   | Y   | N   | N   | N   | N   |
| RefreshToken 쿠키 존재        | Y   | N   | N   | Y   | Y   | Y   |
| RefreshToken 서명/만료 OK     | Y   | -   | -   | N   | Y   | Y   |
| RefreshToken DB 저장값 일치   | Y   | -   | -   | -   | N   | Y   |
| **Actions**                   |     |     |     |     |     |     |
| 보호 엔드포인트 통과          | Y   | N   | N   | N   | N   | N   |
| 401 (AuthRefreshTokenRequired) | N   | Y   | N   | N   | N   | N   |
| 401 (AuthUnauthorized)        | N   | N   | Y   | N   | N   | N   |
| 401 (AuthInvalidRefreshToken) | N   | N   | N   | Y   | Y   | N   |
| Token Rotation 갱신 성공      | N   | N   | N   | N   | N   | Y   |
| audit_log 탈취 의심 알림      | N   | N   | N   | N   | Y   | N   |

축약 근거:
- R2 (Access OK + Refresh 쿠키 없음): 보호 엔드포인트 정상 호출 가정에서 Refresh 쿠키 미존재는 비정상 흐름. 후속 검증 don't care
- R3 (Access NG + Refresh 쿠키 없음): 갱신 자체 불가. 후속 검증 don't care
- R4 (Refresh 검증 NG): DB 일치 여부 검증 불필요 (서명/만료 실패가 더 강한 거부 사유). don't care
- R5 (Refresh 검증 OK + DB 불일치): 이전 Rotation 후 잔존 또는 탈취 의심. R6과 분리 표기하여 audit_log 알림 분기 명시

audit_log 알림: Phase 2 observability.md §3.2 audit_log 테이블 도입 후 활성. Phase 1 시점에는 알림 액션 누락 가능 (구현은 Phase 2에서 보강).

## State Machines

해당 없음. 현 도메인은 명시적 상태 생명주기를 가진 Aggregate가 없음:
- UserAuth: socialYN 'Y'/'N'은 가입 경로 표식(상태 전이 아님). userRole 'USER'/'ADMIN'은 권한 표식(전이 없음)
- Post: 단일 상태(작성 후 published — 별도 draft/archived 상태 없음). hits 증가는 상태 전이가 아닌 카운터 증가
- PostLike: 존재/부재의 이진 토글 (CRUD 자체로 표현, 상태 머신 정형화 가치 없음)

State Machine 적용이 가치를 갖는 시점:
- Phase 3 (BP1/TP1): 알림 도메인 신설 시 알림 상태 생명주기(pending → sent / failed → retried / expired). 본 Phase의 problem-domain-spec 재작성에서 SM 섹션 활성 + 미정의 전이 처리 방침 + DLQ 연결 명시 예정
- ADMIN 모더레이션 도입 시(Out-of-scope): 댓글/답글 상태(visible / hidden / deleted) 도입 가능. 재편입 시점에 SM 적용 판단

## 의미 보존 검증

각 UC-N의 Main Success Scenario가 침해하지 않아야 하는 INV-N 매핑. 일시 침해 가능 시점은 회복 방법 명시.

| UC | Main Success Scenario 단계 | 적용 INV | 비고 |
|---|---|---|---|
| UC-1 (회원가입) | 1~5 | INV-1, INV-3, INV-4, INV-5 | 단계 4 INSERT 트랜잭션 내 INV-1 검증(단계 2 isExist) 후 INV-3은 UserInfo 별도 생성 흐름에서 보장. 위반 시 단계 2/4 거부 |
| UC-2 (로그인) | 1~6 | INV-4 (해시 비교), INV-10·INV-11 (토큰 발급) | 단계 5에서 DB.refreshToken 갱신이 단계 6 쿠키 설정과 트랜잭션 분리 — 부분 성공 가능성은 application-arch에서 트랜잭션 경계로 흡수 (Phase 1 검토 대상) |
| UC-3 (OAuth) | 1~7 | INV-1·INV-3 (신규 생성), INV-5·INV-12 (현 구현), INV-10·INV-11 | 단계 5 신규 생성 분기에서 INV-1 일시 침해 가능 — DB UNIQUE 제약으로 동시 가입 race 차단. **Phase 1 재설계 후 INV-5·INV-12 폐기, provider_subject 기반 동일인 식별로 의미 보존 갱신** |
| UC-4 (토큰 갱신) | 1~5 | INV-10, INV-11 | 단계 5의 QueryRunner 트랜잭션이 INV-11(Rotation 원자성) 보장. 트랜잭션 실패 시 이전 DB 값 보존 (Extension 5a). 일시 침해 없음 |
| UC-5 (글 상세 + hits) | 1~6 | INV-7, INV-10 | 단계 4 hits 증가가 요청 트랜잭션에 결합 — 동시 조회 시 락 경합 발생하나 INV-7 침해는 아님 (단조 증가 보장). **Phase 3 비동기 전환 시 단계 4가 "이벤트 발행"으로 변경되며 INV-7 즉시성 약화 (eventually consistent)** |
| UC-6 (좋아요 추가/취소) | 추가 1~4, 취소 1~4 | INV-8, INV-9, INV-10 | 추가 단계 3 존재 확인과 단계 4 INSERT 사이 동시 요청 race — 복합 PK INSERT 충돌로 두 번째 요청 실패 → INV-8 스키마 수준 보장. 일시 침해 없음 |
| UC-7 (글 목록 조회) | 1~5 | INV-10 (인증 통과) | 직접 매핑되는 도메인 INV 없음. **Phase 1 커서 페이징 전환 후 (writeDatetime DESC, postId DESC) 정렬 일관성 INV 추가 검토** |
| UC-8 (댓글 작성, Phase 1) | 1~5 | INV-10, **신규 INV (Phase 1 재설계 후): Comment.postId 참조 무결성, Comment.userId 참조 무결성** | Phase 1 problem-domain-spec 재작성 시 신규 INV 추가 |
| UC-9 (답글 작성, Phase 1) | 1~5 | INV-10, **신규 INV (Phase 1 재설계 후): Reply.commentId 참조 무결성, 계층 깊이 1단 제한** | 동일 |

## Sources

- docs/context/domain.md §Ubiquitous Language, §도메인 규칙·제약 (UL 매핑된 Invariant 추출)
- docs/context/constraints.md §기존 코드 상태 (엔티티 / 관계 / 복합 PK / CASCADE)
- docs/problem/overview.md §기술 문제 TP1·TP5·TP8, §Phase 근거 (Phase 진화에 따른 INV 변경 시점)
- docs/problem/use-cases.md §UC-1~UC-9, §DT 후보 요약 (DT-1·DT-2 본체 작성 위임)
- docs/meeting-logs/2026-04-24.md §결정 1 (MCPSI 신규 수립 시 도메인 규칙 추출)
- docs/meeting-logs/2026-05-11.md §결정 2 (Phase 1 진입 시 User Aggregate 재설계 범위 유지)
- 본 프로젝트 엔티티: src/user/entities/user-auth.entity.ts, src/user/entities/user-info.entity.ts, src/blog/entities/post.entity.ts, src/blog/entities/post-like.entity.ts
- 본 프로젝트 서비스 레이어: src/user/service/user-auth.service.ts (인증/OAuth/토큰), src/blog/service/post.service.ts (CRUD 권한 / hits 증가)
- DDD Invariant: Evans "Domain-Driven Design" Ch.6 (Aggregate consistency boundary) / Vernon "Implementing DDD" Ch.10
- Decision Table: ISTQB Foundation Level §4.2.3 Decision Table Testing
- State Machine 비활성 근거: UML 2.5.1 §14 Behavior State Machines (적용 대상 부재 판정)
