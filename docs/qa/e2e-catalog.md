<!--
  직접 수정 금지. 본 문서는 E2E 테스트 코드(test/*.e2e-spec.ts)에서 재생성되는 복제본이다.
  테스트 코드가 primary source of truth. 시나리오 변경은 테스트 코드를 수정한 뒤 본 카탈로그를 재생성한다.
  TC 카운트는 본 문서에 미러하지 않는다 (카운트 SoT: docs/implementation/testing-strategy.md §2 Test Pyramid).
-->

# E2E Catalog — Phase 1

수동 QA 대체 E2E 검증의 living documentation. UC별 시나리오를 GWT(Given/When/Then) 도메인 언어로 선언적으로 기술하고, 대응 TC 파일 경로와 통과 확인을 연결한다. 각 UC 섹션은 해당 `[E2E 검증]` 이슈 처리(B4)에서 전 E2E TC 통과 후 테스트 코드로부터 재생성된다.

GWT 작성 규칙 (이슈 B4): 시나리오당 3~5스텝, 도메인 언어(UL 용어), 선언적 스타일(CSS 셀렉터·URL·버튼 라벨 금지). use-cases.md Main Success Scenario / Extensions / Success Guarantees를 도메인 언어로 직역. 형식 규범: ~/.claude/skills/mcpsi-implementation/references/writing-principles.md "E2E 문서화 형식".

매핑 SoT: UC↔flow↔TC 트레이스는 testing-strategy.md §6, 분기 본체는 docs/implementation/flows/{flow-id}.md.

## UC-1: 회원가입 (login_id + password)
- 커버 flow: user-register
- 대응 TC 파일: (E2E 검증 이슈에서 채움)
- 시나리오: (E2E 검증 이슈 B4에서 GWT 작성)

## UC-2: 로그인 (login_id + password)
- 커버 flow: user-login
- 대응 TC 파일: (채움)
- 시나리오: (채움)

## UC-3: Google OAuth 로그인 / 자동가입 (Account Linking)
- 커버 flow: user-oauth-login
- 대응 TC 파일: (채움)
- 시나리오: (채움)

## UC-4: 토큰 갱신 (Refresh Token Rotation)
- 커버 flow: user-token-refresh
- 대응 TC 파일: (채움)
- 시나리오: (채움)

## UC-5: 글 상세 조회 (hits 증가)
- 커버 flow: blog-post-read-detail
- 대응 TC 파일: (채움)
- 시나리오: (채움)

## UC-6: 좋아요 추가 / 취소
- 커버 flow: post-like-toggle
- 대응 TC 파일: (채움)
- 시나리오: (채움)

## UC-7: 글 목록 조회 (커서 페이징)
- 커버 flow: blog-post-list
- 대응 TC 파일: (채움)
- 시나리오: (채움)

## UC-8: 댓글 작성 / 수정 / 삭제
- 커버 flow: comment-write
- 대응 TC 파일: (채움)
- 시나리오: (채움)

## UC-9: 답글 작성 / 수정 / 삭제
- 커버 flow: reply-write
- 대응 TC 파일: (채움)
- 시나리오: (채움)

## Sources
- docs/problem/use-cases.md (UC-1~9 Main + Extensions)
- docs/implementation/testing-strategy.md §6 (UC↔flow↔TC 트레이스, 카운트 SoT)
- docs/implementation/flows/*.md (분기 본체)
- test/*.e2e-spec.ts (primary — 본 카탈로그 재생성 원천)
