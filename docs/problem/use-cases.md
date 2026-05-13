# Problem — Use Cases

본 문서는 Cockburn 6단 포맷의 Use Case만 다룬다. 도메인 Invariant·Decision Table 본체·State Machine은 domain-spec.md, 비기능 요구는 nfr-qas.md, 보안 위협은 threat-model.md, BP/TP 매핑은 overview.md 참조.

대상 UC는 아키텍처적으로 중요한 흐름에 한정한다. 프레임워크 수준 단순 CRUD(글 작성/수정/삭제, UserInfo 생성/수정 등)는 권한·소유권 검증 외 비자명 분기가 없어 별도 UC로 분리하지 않는다. 단, "권한 + 소유권 + 자원 종류" 조합 분기가 등장하는 시점(예: ADMIN 모더레이션 도입 — 현재 out-of-scope)에는 별도 UC로 승격.

## UC 인벤토리

- UC-1 회원가입 (uid + password)
- UC-2 로그인 (uid + password)
- UC-3 Google OAuth 로그인/자동가입
- UC-4 토큰 갱신 (Refresh Token Rotation)
- UC-5 글 상세 조회 (hits 증가)
- UC-6 좋아요 추가/취소
- UC-7 글 목록 조회 (Phase 1 커서 페이징 전환)
- UC-8 댓글 작성 (Phase 1 신설)
- UC-9 답글 작성 (Phase 1 신설)

## UC↔BP 커버리지

- BP1 (비동기 시스템 학습): UC-5 (hits 동기 증가가 Phase 3 비동기 집계 전환 대상), UC-6 (좋아요 집계 비동기 전환 대상)
- BP3 (기능 불완전 + 도메인 정합성):
  - TP3 댓글/답글: UC-8, UC-9
  - TP3 중복 요청 방지(Idempotency-Key): UC-1·UC-6·UC-8·UC-9의 `*a` Extension (POST 계열 공통)
  - TP4 커서 페이징: UC-7
  - TP5 User 식별자 재설계: UC-3 Known Issue → Phase 1 재설계
- BP2 (부하 테스트), BP4 (관측성), BP5 (Phase 0 종료), BP6 (프로덕션 품질): 사용자 상호작용 없는 인프라/cross-cutting 영역. 직접 UC 매핑 없음. UC 흐름 내 인프라 적용 지점은 응답/추적/표준화 cross-cutting으로 작용 (예: BP6의 RFC 9457은 모든 UC의 실패 응답 포맷에 적용)

## UC-1: 회원가입 (uid + password)

Goal in Context: 신원 미확인 방문자가 자체 인증 수단(uid + password)으로 사용자 계정을 등록한다.

Primary Actor: 미인증 방문자 (context/overview.md "1차 사용자")

Stakeholders & Interests:
- 미인증 방문자: 자체 인증 수단으로 계정을 만들고 즉시 글 작성/조회 가능 상태가 된다
- 시스템 운영자(개발자 본인): uid 전역 유일성 보장, 비밀번호 평문 미저장, 중복 요청 시 동일 결과 보장

Preconditions:
- 사용자가 입력한 uid가 시스템에 존재하지 않거나, 동일 (uid, password) 조합으로 직전 가입을 재시도하는 경우 (Idempotency-Key 보유)
- 클라이언트가 가입 요청 본문(uid, password)을 전송할 수 있는 상태

Trigger: 클라이언트가 `POST /users/auth/join`을 호출한다.

Main Success Scenario:
1. 클라이언트가 uid + password를 본문으로 가입 요청한다.
2. 시스템이 `isExist(uid)`로 uid 중복을 검증한다.
3. 시스템이 salt 생성 + 비밀번호 해싱한다 (현 구현 SHA256 3회, Phase 5에서 argon2id 전환).
4. 시스템이 UserAuth(socialYN='N', userRole=USER)를 저장한다.
5. 시스템이 성공 응답을 반환한다.

Extensions:
- 2a. uid 중복: 시스템이 UserAlreadyExistsException을 발생시키고 실패 응답을 반환한다. 기존 UserAuth는 변경되지 않는다.
- *a. Idempotency-Key 처리 (Phase 1 도입): 동일 키 + 동일 요청 본문이면 이전 응답을 재사용한다 [DT-1 참조 → domain-spec.md]
  - *a-1. 키 미제공: 일반 흐름 진행
  - *a-2. 키 제공 + 캐시 hit + 응답 stored: 저장된 응답 즉시 반환
  - *a-3. 키 제공 + 캐시 miss: 처리 결과를 키와 함께 캐시에 저장 (TTL 적용)
  - *a-4. 키 제공 + in-flight: 후속 요청은 진행 중 처리 완료 대기 또는 409 반환 (Solution 단계 확정)

Success Guarantees: UserAuth가 생성되며, uid는 전역 유일성을 유지한다. password는 해시 형태로만 저장된다.
Failed End Conditions (Minimal Guarantee): UserAuth는 생성되지 않고 DB 상태는 불변. 클라이언트는 실패 사유(uid 중복 등)를 받는다.

## UC-2: 로그인 (uid + password)

Goal in Context: 등록된 사용자가 자체 인증 수단으로 본인 신원을 시스템에 증명하고 AccessToken + RefreshToken을 발급받는다.

Primary Actor: 미인증 등록 사용자 (UserAuth 존재)

Stakeholders & Interests:
- 등록 사용자: 인증 통과 후 보호된 API에 접근 가능 상태가 된다
- 시스템 운영자: 비밀번호 무차별 대입 방지(Phase 1 #11 로그인 실패 카운트 도입 예정), RefreshToken 서버측 세션 검증으로 즉시 세션 무효화 가능 상태 유지

Preconditions:
- 해당 uid로 UserAuth가 존재한다
- 클라이언트가 uid + password를 전송할 수 있는 상태

Trigger: 클라이언트가 `POST /users/auth/login`을 호출한다.

Main Success Scenario:
1. 클라이언트가 uid + password를 본문으로 로그인 요청한다.
2. 시스템이 UserAuth를 조회한다.
3. 저장된 salt로 password 재해싱 후 저장된 해시와 비교한다.
4. 시스템이 AccessToken + RefreshToken을 발급한다.
5. 시스템이 UserAuth.refreshToken을 새 RefreshToken으로 갱신한다.
6. 시스템이 RefreshToken을 HTTPOnly 쿠키로 설정하고 AccessToken을 응답 본문으로 반환한다.

Extensions:
- 2a. UserAuth 미존재: UserNotFoundException 반환. DB 상태 불변.
- 3a. 비밀번호 불일치: AuthInvalidPasswordException 반환. DB 상태 불변.
  - 3a-1. (Phase 1 #11 도입 후) 로그인 실패 카운트 증가. 임계값 초과 시 임시 잠금 상태 진입 (구체 정책은 Solution 단계 확정)

Success Guarantees: AccessToken + RefreshToken이 발급되고 DB.refreshToken이 갱신된다. 응답 후 클라이언트는 보호 엔드포인트 호출 가능.
Failed End Conditions (Minimal Guarantee): 토큰 미발급 + DB 상태 불변. 비밀번호 평문은 어떤 응답에도 노출되지 않는다.

## UC-3: Google OAuth 로그인 / 자동가입

Goal in Context: Google ID Token을 보유한 방문자가 Google 신원 검증을 통해 시스템에 로그인하거나, 처음이면 자동 가입한다.

Primary Actor: Google 인증을 완료한 미인증 방문자

Stakeholders & Interests:
- 방문자: Google 계정으로 별도 비밀번호 없이 로그인 가능
- 시스템 운영자: 외부 토큰(Google ID Token)을 내부 신원 모델로 변환할 때 신뢰 경계 유지, Google 신원 변경/유출 시 동일인 식별 기반 유지

Preconditions:
- 클라이언트가 유효한 Google ID Token (credentialToken)을 보유
- 시스템에 `GOOGLE_CLIENT_ID` 환경변수가 설정됨

Trigger: 클라이언트가 `POST /users/auth/oauth`를 호출한다.

Main Success Scenario:
1. 클라이언트가 credentialToken을 본문으로 OAuth 요청한다.
2. 시스템이 google-auth-library로 ID Token을 검증한다 (서명/만료/audience).
3. 시스템이 payload에서 식별자를 추출한다 (현 구현: payload.email을 uid로 사용 — Phase 1 TP5에서 provider_subject 기반 재설계).
4. 시스템이 추출 식별자로 기존 UserAuth 존재 여부를 확인한다.
5. (신규) 시스템이 UserAuth(socialYN='Y', password='-', salt='-')를 생성한다.
6. 시스템이 AccessToken + RefreshToken을 발급한다.
7. 시스템이 UserAuth.refreshToken을 갱신하고 쿠키로 RefreshToken을 설정한다.

Extensions:
- 2a. 토큰 검증 실패 (서명/만료/audience 불일치): AuthInvalidOauthTokenException 반환. DB 상태 불변.
- 4a. 기존 UserAuth 존재: 5단계(생성) 생략 후 6단계(JWT 발급)부터 진행
  - 4a-1. (현 구현 한계) 기존 일반 가입 사용자와 동일 이메일의 OAuth 사용자가 별개로 식별되지 않을 가능성. Phase 1 TP5 재설계 후에는 provider_subject + linked_user_id로 정규화

Success Guarantees: AccessToken + RefreshToken 발급. 신규 진입 시 UserAuth가 생성된다.
Failed End Conditions (Minimal Guarantee): 토큰 미발급, DB 상태 불변, 외부 토큰 페이로드의 어떤 PII도 응답에 노출되지 않는다.

Known Issue: 현 구현은 `payload.email`을 uid로 사용하여 일반 가입과 OAuth 가입 간 동일인 식별 기반이 부재. Phase 1 TP5에서 user_auth_provider 신설 + provider_subject(OAuth sub) 기반으로 재설계 예정. 본 UC는 Phase 1 종료 시점 재작성 대상.

## UC-4: 토큰 갱신 (Refresh Token Rotation)

Goal in Context: AccessToken 만료 상태의 인증 사용자가 RefreshToken을 사용해 새 토큰 쌍을 발급받고 세션을 연장한다.

Primary Actor: 등록 사용자 (AccessToken 만료, RefreshToken HTTPOnly 쿠키 유효)

Stakeholders & Interests:
- 사용자: 재로그인 없이 세션 연장
- 시스템 운영자: Rotation 원자성 보장으로 토큰 탈취 시 즉시 무효화 가능, DB 저장값 동시 갱신으로 replay 공격 방어

Preconditions:
- 클라이언트가 유효한 RefreshToken HTTPOnly 쿠키를 보유
- 해당 RefreshToken이 DB UserAuth.refreshToken과 일치

Trigger: 클라이언트가 `POST /users/auth/refresh`를 호출한다 (AccessToken 만료 응답 수신 시 자동 또는 사용자 액션).

Main Success Scenario:
1. 클라이언트가 RefreshToken 쿠키와 함께 갱신 요청한다.
2. 시스템이 RefreshToken의 서명/만료를 검증한다.
3. 시스템이 RefreshToken을 DB 저장값(UserAuth.refreshToken)과 대조한다.
4. 시스템이 새 AccessToken + RefreshToken을 발급한다.
5. 시스템이 트랜잭션 내에서 DB.refreshToken을 새 값으로 갱신하고 쿠키를 재설정한다.

Extensions:
- 1a. RefreshToken 쿠키 누락: AuthRefreshTokenRequiredException 반환. DB 상태 불변.
- 2a. 토큰 검증 실패 (서명/만료): AuthInvalidRefreshTokenException 반환. DB 상태 불변.
- 3a. DB 저장값 불일치 (이전 Rotation 후 잔존 / 탈취 가능성): AuthInvalidRefreshTokenException 반환. DB 상태 불변. 운영자 알림 대상 후보(Phase 2 audit_log).
- 5a. 갱신 트랜잭션 실패: 새 토큰 발급 취소, 이전 DB 값 보존 (Rotation 원자성 — Invariant)

본 UC의 분기 흐름은 토큰 이중 검증 결과(AccessToken 만료 여부 + RefreshToken 쿠키 존재 + RefreshToken 검증 + DB 일치)의 조합으로 일반화되며, AccessToken 만료 응답 → UC-4 진입 흐름까지 묶어보면 의미 있는 DT. [DT-2 참조 → domain-spec.md "토큰 이중 검증"]

Success Guarantees: 새 AccessToken + RefreshToken이 클라이언트에 전달되고 DB가 동시 갱신된다. 이전 RefreshToken은 즉시 무효화된다.
Failed End Conditions (Minimal Guarantee): 새 토큰 미발급 + DB 상태 불변. 부분 성공(새 RefreshToken만 발급되고 DB 갱신 실패 등)은 발생하지 않는다.

## UC-5: 글 상세 조회 (hits 증가)

Goal in Context: 인증 사용자가 특정 글의 상세 내용과 좋아요 정보를 조회하고, 시스템은 글 조회수를 1 증가시킨다.

Primary Actor: 인증된 사용자 (USER role)

Stakeholders & Interests:
- 조회 사용자: 글 본문 + 작성자 + 좋아요 상태를 일관된 시점에서 확인
- 시스템 운영자: 조회수 단조 증가 보장(감소 금지), Phase 3 비동기 집계 전환 시 응답 일관성 유지

Preconditions:
- 클라이언트가 유효한 AccessToken + RefreshToken을 보유 (전역 AuthGuard 통과)
- 요청 경로의 암호화된 postId가 복호화 가능

Trigger: 클라이언트가 `GET /posts/:postId`를 호출한다 (postId는 AES 암호화 문자열).

Main Success Scenario:
1. 클라이언트가 암호화된 postId로 상세 조회 요청한다.
2. DecryptPrimaryKeyPipe가 PK를 복호화한다.
3. 시스템이 Post를 조회한다.
4. 시스템이 hits를 1 증가시킨다 (현 구현 동기, Phase 3 비동기 전환 대상).
5. 시스템이 `getPostLikeMapByPostIds()`로 좋아요 정보를 배치 로드한다.
6. 시스템이 PostDto(@EncryptField 적용)를 반환하며 EncryptPrimaryKeyInterceptor가 응답 PK를 암호화한다.

Extensions:
- 2a. PK 복호화 실패: InvalidEncryptedParameterException 반환. hits 불변.
- 3a. Post 미존재: PostNotFoundException 반환. hits 불변.

Success Guarantees: 상세 정보가 반환되고 hits가 정확히 1 증가한다. 동일 트랜잭션 내 정합성 유지.
Failed End Conditions (Minimal Guarantee): hits 불변. 부분 증가(중복 +N) 없음.

Known Issue: 4단계 hits 증가가 요청 트랜잭션에 결합되어 동시 조회 시 락 경합 + 응답 지연 원인. Phase 3 TP1에서 비동기 집계로 전환 시 본 UC의 4단계가 "이벤트 발행"으로 변경되며 Success Guarantees의 즉시성 약화(eventually consistent)로 재정의 예정.

## UC-6: 좋아요 추가 / 취소

Goal in Context: 인증 사용자가 특정 글에 좋아요를 추가하거나 본인의 기존 좋아요를 취소한다.

Primary Actor: 인증된 사용자

Stakeholders & Interests:
- 사용자: 1인 1회 좋아요 제한 보장 (중복 추가 불가, 취소 후 재추가는 가능)
- 글 작성자: 좋아요 집계가 본인 글의 인기 지표로 활용 (자기 좋아요 가능 — 현재 명시적 제약 없음)
- 시스템 운영자: 복합 PK 스키마 제약으로 동시 요청 중복 차단, Phase 3 비동기 집계 전환 시 집계 정합성 유지

Preconditions:
- 인증 통과 + 해당 postId의 Post 존재

Trigger:
- 추가: 클라이언트가 `POST /posts/:postId/likes`를 호출한다
- 취소: 클라이언트가 `DELETE /posts/:postId/likes`를 호출한다

Main Success Scenario (추가):
1. 클라이언트가 좋아요 추가 요청한다.
2. DecryptPrimaryKeyPipe가 postId를 복호화한다.
3. 시스템이 (postId + uid) 복합 PK로 PostLike 존재 여부를 확인한다.
4. 시스템이 신규 PostLike를 저장한다.

Extensions (추가):
- 3a. 이미 존재: PostLikeAlreadyExistsException 반환. 상태 불변.
- *a. Idempotency-Key 처리 (Phase 1): UC-1 *a와 동일한 DT-1 흐름 적용 (domain-spec.md §DT-1 참조)

Main Success Scenario (취소):
1. 클라이언트가 좋아요 취소 요청한다.
2. DecryptPrimaryKeyPipe가 postId를 복호화한다.
3. 시스템이 (postId + uid)로 PostLike를 조회한다.
4. 시스템이 PostLike를 삭제한다.

Extensions (취소):
- 3a. PostLike 미존재: PostLikeNotFoundException 반환. 상태 불변.

Success Guarantees: PostLike가 추가되거나 제거되어 1인 1회 제약을 유지한다.
Failed End Conditions (Minimal Guarantee): PostLike 상태 불변.

Known Issue: 좋아요 집계 카운트는 조회 시점마다 `getPostLikeMapByPostIds()`로 산정. 글 목록/상세 조회 응답 지연의 한 원인. Phase 3 TP1에서 비동기 집계 캐시 전환 시 본 UC의 Success Guarantees가 "집계 캐시 invalidate 이벤트 발행"으로 변경 예정.

## UC-7: 글 목록 조회 (Phase 1 커서 페이징 전환)

Goal in Context: 인증 사용자가 전체 글 목록 또는 특정 사용자의 글 목록을 시간 역순으로 페이징 조회한다.

Primary Actor: 인증된 사용자

Stakeholders & Interests:
- 사용자: 최신순 일관 정렬 + 무한 스크롤 지원
- 시스템 운영자: 깊은 페이지 성능 저하 없음, 동시 쓰기 중 중복/누락 없음(커서 페이징), N+1 회피 (좋아요 정보 배치 로드)

Preconditions: 인증 통과 (전역 AuthGuard)

Trigger:
- 전체 목록: 클라이언트가 `GET /posts?cursor={...}&limit=20`을 호출한다
- 특정 사용자: 클라이언트가 `GET /posts/users/:postUid?cursor={...}&limit=20`을 호출한다

Main Success Scenario (Phase 1 전환 후 — 커서 기반):
1. 클라이언트가 cursor (첫 페이지는 미지정) + limit을 쿼리로 전송한다.
2. 시스템이 (writeDatetime DESC, postId DESC) 복합 키 정렬로 cursor 다음 항목을 limit개 조회한다.
3. 시스템이 `getPostLikeMapByPostIds()`로 좋아요 정보를 배치 로드한다 (N+1 회피).
4. 시스템이 마지막 항목의 (writeDatetime, postId)로 다음 cursor를 생성한다.
5. 시스템이 항목 배열 + next_cursor를 반환한다.

Extensions:
- 1a. cursor 형식 오류: InvalidEncryptedParameterException 반환 (cursor가 암호화 PK 포함 시) 또는 빈 결과
- 2a. 결과 없음: 빈 배열 + next_cursor=null 반환 (실패 아님)

Success Guarantees: 정렬 순서 일관성 유지. 동시 쓰기 발생 중에도 cursor 기반으로 항목 중복/누락 없음.
Failed End Conditions (Minimal Guarantee): 빈 결과 반환. 시스템 상태 불변.

Current Implementation (Phase 1 전환 전): offset 페이징 (take=20, skip=page×20). 깊은 페이지 시 skip 비용 증가 + 동시 쓰기 시 중복/누락 위험. TP4 대상.

## UC-8: 댓글 작성 (Phase 1 신설)

Goal in Context: 인증 사용자가 특정 글에 댓글을 작성한다.

Primary Actor: 인증된 사용자

Stakeholders & Interests:
- 작성자: 본인 댓글 작성/수정/삭제 권한 보유
- 글 작성자: 본인 글에 달린 댓글 조회 가능 (Phase 3 알림 도입 시 신규 댓글 알림 수신)
- 시스템 운영자: Idempotency-Key로 중복 댓글 차단, Phase 3 알림 비동기 전환 대상

Preconditions:
- 인증 통과 + 댓글 대상 Post 존재
- Phase 1 User Aggregate 재설계 완료 (userId BIGINT 외래키 참조)

Trigger: 클라이언트가 `POST /posts/:postId/comments`를 호출한다.

Main Success Scenario:
1. 클라이언트가 암호화된 postId + 댓글 본문을 요청한다.
2. DecryptPrimaryKeyPipe가 postId를 복호화한다.
3. 시스템이 Post 존재를 확인한다.
4. 시스템이 Comment를 저장 (post_id 외래키, user_id 외래키 = 인증 사용자).
5. 시스템이 저장된 Comment 정보를 반환한다 (응답 PK 암호화).

Extensions:
- 3a. Post 미존재: PostNotFoundException 반환. Comment 미저장.
- *a. Idempotency-Key 처리 (Phase 1): UC-1 *a와 동일한 DT-1 흐름 적용 (domain-spec.md §DT-1 참조). 같은 키로 재요청 시 동일 댓글 ID 반환 (중복 댓글 미생성)

Success Guarantees: Comment가 저장되며 작성자(user_id), 대상 글(post_id), 작성 시각이 정합되게 기록된다.
Failed End Conditions (Minimal Guarantee): Comment 미저장 + DB 상태 불변.

Phase 3 변경 예고: 5단계 후 "댓글 작성 이벤트 발행" 단계 추가 → notification 모듈이 글 작성자에게 알림 발송 (async-processing.md).

본 UC의 수정/삭제 흐름은 권한 검증(본인 == 작성자) + 댓글 존재의 단순 조합으로 별도 UC가 아닌 본 UC의 변형으로 다룬다. ADMIN 모더레이션 도입 시(현재 out-of-scope) 권한 + 소유권 + 자원 종류의 조건 곱집합이 발생하여 별도 UC + DT 후보로 승격.

## UC-9: 답글 작성 (Phase 1 신설)

Goal in Context: 인증 사용자가 특정 댓글에 답글을 작성한다.

Primary Actor: 인증된 사용자

Stakeholders & Interests:
- 작성자: 답글 작성/수정/삭제 권한
- 원 댓글 작성자: 본인 댓글에 달린 답글 알림 수신 (Phase 3 알림)
- 시스템 운영자: 계층 깊이 1단(댓글 → 답글)으로 제한, Idempotency-Key로 중복 차단

Preconditions:
- 인증 통과 + 답글 대상 Comment 존재 + 해당 Comment의 Post 존재

Trigger: 클라이언트가 `POST /comments/:commentId/replies`를 호출한다 (구체 경로는 Solution 단계 확정).

Main Success Scenario:
1. 클라이언트가 암호화된 commentId + 답글 본문을 요청한다.
2. DecryptPrimaryKeyPipe가 commentId를 복호화한다.
3. 시스템이 Comment 존재를 확인한다.
4. 시스템이 Reply를 저장 (comment_id 외래키, user_id 외래키).
5. 시스템이 저장된 Reply 정보를 반환한다.

Extensions:
- 3a. Comment 미존재: CommentNotFoundException 반환 (예외 클래스는 Phase 1 신설). Reply 미저장.
- *a. Idempotency-Key 처리 (Phase 1): UC-1 *a와 동일 흐름 (domain-spec.md §DT-1 참조)

Success Guarantees: Reply가 저장되며 작성자, 대상 댓글이 정합되게 기록된다.
Failed End Conditions (Minimal Guarantee): Reply 미저장 + DB 상태 불변.

Phase 3 변경 예고: UC-8과 동일하게 5단계 후 알림 이벤트 발행 단계 추가.

## DT 본체 위치 (domain-spec.md 참조)

본 UC 세트에서 식별된 Decision Table은 domain-spec.md §Decision Tables에 본체가 위치한다:

- DT-1 (Idempotency-Key 처리): UC-1, UC-6(추가), UC-8, UC-9의 `*a` Extension에서 참조. Phase 1 도입 cross-cutting 처리 분기 — Solution `application-arch.md` 인터셉터/미들웨어 설계 입력
- DT-2 (토큰 이중 검증): 보호 엔드포인트 진입(전역 AuthGuard) + UC-4 토큰 갱신 흐름에서 참조. 인증 통과 / 갱신 성공 / 강제 무효화 / 탈취 의심 분기 — Phase 2 audit_log 알림 대상 분기와 결합

## Sources

- docs/context/overview.md §이해관계자, §사업 목표 (Primary Actor 매핑)
- docs/context/domain.md §Ubiquitous Language, §도메인 규칙, §워크플로우
- docs/problem/overview.md §비즈니스 문제 BP1~BP6, §기술 문제 TP1~TP8, §Phase 근거
- docs/meeting-logs/2026-04-24.md (MCPSI 신규 수립)
- docs/meeting-logs/2026-05-11.md §결정 2 (Phase 1 범위 유지 — TP3 댓글/답글/Idempotency-Key, TP4 커서 페이징, TP5 User 식별자 재설계)
- 본 프로젝트 소스 코드 (UC-1~7 현 구현): src/user/controller/user-auth.controller.ts, src/user/service/user-auth.service.ts, src/blog/controller/post.controller.ts, src/blog/service/post.service.ts, src/blog/repository/post.repository.ts
- UC 작성 방법론: Cockburn "Writing Effective Use Cases" (Addison-Wesley, 2001) 6단 포맷 — Goal in Context / Primary Actor / Stakeholders & Interests / Preconditions / Trigger / Main Success Scenario / Extensions + Success Guarantees + Failed End Conditions
- DT 식별 기준: ISTQB Foundation §4.2.3 Decision Table Testing (4 조건 이상 또는 조건 곱집합 8개 이상)
- Idempotency-Key 처리 흐름 참조: Stripe API Idempotency, IETF draft-ietf-httpapi-idempotency-key-header (Phase 1 Solution 단계 확정)
