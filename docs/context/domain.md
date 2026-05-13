---
migrated: abundant-nibbling-toast-S-2
---

# Context — Domain

DDD Strategic Design 영역(Ubiquitous Language / Bounded Contexts / Context Map)과 도메인 규칙·워크플로우. 비즈니스 맥락·이해관계자는 overview.md, 기술 제약은 constraints.md.

## Viewpoint 정의 (IEEE 42010)

- 본 viewpoint: 도메인 모델 (UL / BC / Context Map / 도메인 규칙)
- 대상 stakeholder: overview.md의 "개발자 1명 (사용자 본인)" — 모델 일관성 유지 책임자. "외부 독자(잠재)" — UL을 통한 결정 이해 보조
- 다루는 concern: 도메인 의미 일관성, 모델 경계, 도메인 규칙 정합성. Phase 1 User Aggregate 재설계가 UL/도메인 규칙에 영향을 주는지 사전 식별 가능하도록 함

## Ubiquitous Language

단일 BC 프로젝트이므로 Context 표기는 생략. Phase 1에서 User 식별자 재설계(TP5)로 일부 용어의 의미가 변경될 예정이며 변경 시점은 해당 Phase의 docs/problem.md / data-design.md 참조.

- uid: 사용자 고유 식별자 (현 구현: 사용자가 가입 시 입력한 문자열 100자). 사용처: UserAuthEntity PK, JWT payload sub 클레임, request.headers['authenticatedUser']. **Phase 1 변경 예정**: 내부 식별자 userId(BIGINT)와 인증 식별자(uid) 분리, uid는 UserAuthProvider 소속으로 이동
- userId: Phase 1 도입 예정. 사용자 Aggregate의 내부 PK(BIGINT). UserInfo·Post·Comment·Reply 외래키. 현 구현에는 없음
- UserAuth: 사용자 인증 정보 집합 (uid, password, salt, refreshToken, userRole, socialYN). 사용처: UserAuthEntity (USER_AUTH 테이블), 인증/인가 전체. Phase 1에서 UserAuthProvider로 인증 수단(local + Google)을 1:N 분리 예정
- UserAuthProvider: Phase 1 신설 예정. 한 user에 대한 인증 수단(local password / google) 정규화. 외부 OAuth sub(provider_subject)로 신원 일치 식별
- UserInfo: 사용자 프로필 정보 (uid, nickname, introduce). nickname은 UNIQUE 제약. 사용처: UserInfoEntity (USER_INFO 테이블), 프로필 조회/수정
- UserRole: 사용자 역할 enum. ADMIN, USER 두 값. 현 구현에서 두 역할의 차등 권한은 @Roles 데코레이터 매칭 외 실질 구현 없음 (unknowns.md "도메인" 항목으로 승계)
- socialYN: 소셜 로그인 가입 여부 플래그 ('Y' 또는 'N' 단일 char). 사용처: UserAuthEntity, Google OAuth 분기 처리. Phase 1에서 UserAuthProvider 분리로 deprecated 예정
- Post: 블로그 글 (postId, postUid, title, contents, hits, 타임스탬프). 사용처: PostEntity (POST 테이블)
- postUid: Post의 작성자 식별자 외래키. PostEntity에서 UserAuthEntity.uid 참조. 사용처: 작성 권한 검증 (본인 수정/삭제 판단). Phase 1에서 userId(BIGINT) 참조로 변경 예정
- Hits: 글 조회수. 상세 조회 시 동기 증가. 사용처: PostEntity.hits (기본값 0). Phase 3에서 비동기 집계로 전환 예정
- PostLike: 좋아요 관계 엔티티. postId + uid 복합 PK로 1인 1회 제한을 스키마 수준에서 강제. 사용처: PostLikeEntity (POST_LIKE 테이블)
- Comment: Phase 1 신설 예정. 글에 달리는 댓글 (이슈 #6)
- Reply: Phase 1 신설 예정. 댓글에 달리는 답글 (이슈 #7)
- UserSession: TypeORM 엔티티 아님. RefreshToken 검증 결과 인메모리 값 객체. 사용처: AuthGuard 내부
- Primary Key 암호화: API 경계에서 정수 PK를 AES 암호화 문자열로 치환. Service/Repository 내부는 평문 사용. 사용처: @EncryptField 데코레이터, DecryptPrimaryKeyPipe(요청), EncryptPrimaryKeyInterceptor(응답). Phase 5에서 AES-ECB → AES-GCM 전환 예정
- AccessToken: JWT 형식. Authorization 헤더 "Bearer {token}" 전달. 기본 유효 1시간
- RefreshToken: JWT 형식. HTTPOnly 쿠키 전달. 기본 유효 30일. DB(USER_AUTH.refreshToken)에 저장되어 이중 검증
- Token Rotation: refresh 호출 시 access + refresh 둘 다 재발급하며 DB 저장값도 갱신. replay 공격 방어 내장
- Idempotency-Key: Phase 1 도입 예정. 멱등 PUT/POST 요청 식별자. HTTP 헤더 + 서버 측 캐시(Redis)로 중복 처리 방지
- Correlation ID: Phase 2 도입 예정. 요청 단위 추적 식별자. AsyncLocalStorage 기반 자동 전파

UL 포함 기준 충족 사유:
- 모든 항목이 도메인 전문가-개발자가 다른 의미로 쓸 수 있거나 상태 생명주기를 갖는 Entity / 핵심 값 객체
- "uid"는 Phase 1 재설계로 의미가 변경되므로 Phase 간 의미 차이 명기 (변경 전: 사용자 입력 문자열 PK / 변경 후: UserAuthProvider 소속 인증 식별자)

## Bounded Contexts 초안

단일 BC.

- 이름: Blog Service
- 책임 영역: 사용자 인증/프로필 관리 + 블로그 글 CRUD + 좋아요 관계 (Phase 1에서 댓글/답글 포함)
- 담당 팀: 단일 개발자 (사용자 본인)
- 주요 Aggregate 후보 (현 구현 기준, Solution 단계에서 확정):
  - 현재: User (UserAuth + UserInfo), Post (Post + PostLike)
  - Phase 1 이후: User (UserAuth + UserAuthProvider + UserInfo), Post (Post + PostLike + Comment + Reply)

## Context Map 초안

해당 없음 — 단일 BC 또는 외부 통합 없음. 외부 통합은 Google OAuth ID Token 검증 1건뿐이며, 이는 BC 간 관계가 아닌 외부 서비스 Anticorruption Layer 수준의 단순 사용 (google-auth-library 통한 Token Payload 추출 → 내부 User Aggregate로 변환).

## 도메인 규칙·제약

현 구현에서 추출. Phase 1 변경 예정 항목은 명기.

1. 회원 관리
   - 신규 가입: uid 중복 검증 후 USER 역할 기본 할당 (src/user/service/user-auth.service.ts)
   - 비밀번호 저장: salt + SHA256 3회 반복 해싱 후 저장. Phase 5에서 argon2id 전환 예정
   - Google OAuth 가입: 기존 uid 존재 여부 확인. 없으면 자동 신규 가입 (socialYN='Y'), 있으면 기존 계정 로그인. **현 한계**: payload.email을 uid로 사용 → 일반 가입과 동일인 식별 불가. Phase 1 TP5에서 provider_subject(OAuth sub)로 재설계 예정
   - 토큰 갱신: access + refresh 둘 다 재발급 (Token Rotation). DB에 저장된 refreshToken 함께 업데이트

2. 인증 흐름
   - 모든 엔드포인트 기본 인증 필수 (전역 AuthGuard 적용)
   - @Public() 데코레이터로 명시적 화이트리스트 (공개 엔드포인트 4개: join, login, refresh, oauth)
   - 이중 검증: Authorization 헤더의 accessToken (JWT 서명/만료) + HTTPOnly 쿠키의 refreshToken (DB 저장값과 대조)
   - 두 토큰 중 하나라도 실패 시 401
   - 배경 조사 문서: docs/tech-notes/token-validation-strategies/ (Phase 0 Type A 블로그)

3. 글 관리
   - 작성 권한: 인증된 사용자 (USER 역할)
   - 수정/삭제 권한: 본인만 (postUid == authUid로 저장소에서 검증). ADMIN 차등 권한 미구현
   - 목록 조회: 최신순, 페이지당 20개 고정 (TAKE=20). Phase 1에서 (writeDatetime DESC, postId DESC) 복합 키 커서 페이징으로 전환 예정 (TP4)
   - 상세 조회 시 hits 동기 증가. Phase 3에서 비동기 집계로 전환 예정

4. 좋아요
   - 1인 1회 제한: postId + uid 복합 PK로 스키마 강제
   - 자기 글 좋아요 가능 (명시적 제약 없음)
   - 취소 가능 (DELETE 엔드포인트 제공)

5. 멱등성 (Phase 1 도입 예정)
   - Idempotency-Key 헤더 기반 중복 요청 방지
   - 적용 대상: POST(글/댓글/답글/좋아요/회원가입)
   - 캐시 백엔드: Redis (TTL 24h 기준, Solution 단계 확정)

## 워크플로우

사용자 작업 흐름 (현 구현 기준):

1. 회원가입 (uid+password) 또는 Google OAuth 로그인
2. UserInfo 생성 (nickname, introduce)
3. 전체 글 목록 또는 특정 사용자 글 목록 조회
4. 글 상세 조회 (hits 증가)
5. 좋아요 추가 또는 취소
6. 본인 글 작성/수정/삭제

Phase 1 이후 추가 흐름:
7. 글에 댓글 작성, 댓글에 답글 작성 (#6, #7)
8. 댓글/답글 수정/삭제 (본인만)
9. 커서 페이징 기반 글 목록 무한 스크롤
10. Idempotency-Key 기반 중복 요청 방어

거시 맥락: 이 서비스는 외부 블로그 프론트엔드/모바일 앱의 백엔드로 동작하는 것을 상정. 프론트엔드는 이 프로젝트 범위 밖. 외부 actor는 Google OAuth ID Token 발급자(Google Identity Platform) 1개.

도메인 이벤트 인벤토리: Event Storming 미수행. Phase 3에서 비동기 이벤트 도입 시 인벤토리 명시 예정 (docs/solution/async-processing.md §이벤트 계약).

## Sources

- docs/meeting-logs/2026-04-24.md §결정 1 / §미결정 1 (Phase 분리 근거 입력)
- docs/meeting-logs/2026-05-11.md §결정 2 (Phase 1 진입 시 User Aggregate 재설계 범위 유지)
- 기존 코드 분석 (Explore, 2026-04-24): 엔티티 / API 엔드포인트 / 서비스 레이어 도메인 규칙
- docs/tech-notes/token-validation-strategies/ (Phase 0 Type A 블로그)
- 백업: .claude/migrations/abundant-nibbling-toast-S-2/backup/docs/context.md
