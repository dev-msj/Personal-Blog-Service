# 토큰 검증 전략 비교

## 개요

JWT 기반 인증에서 access token만으로는 즉시 세션 무효화가 불가능한 한계가 있다. 이를 보완하기 위해 서버 측 검증을 추가하는 3가지 전략을 비교한다. 이 문서는 PR #44 코드 리뷰에서의 논의를 정리한 것이다.

## Access Token만 사용하는 표준 방식의 한계

표준 JWT 인증 흐름은 stateless하다. 서버는 access token의 서명과 만료만 검증하며, 별도 저장소를 조회하지 않는다.

```
클라이언트 → Authorization: Bearer {accessToken} → 서버
서버: JWT 서명 검증 + 만료 확인 → 통과/거부
```

이 방식의 근본적인 문제는 **발급된 토큰을 즉시 무효화할 수 없다**는 것이다.

| 시나리오 | 기대 동작 | 실제 동작 |
|---|---|---|
| 사용자 로그아웃 | 즉시 접근 차단 | 만료까지 토큰 유효 |
| 비밀번호 변경 | 기존 세션 무효화 | 기존 토큰으로 계속 접근 가능 |
| 관리자 계정 차단 | 즉시 차단 | 만료까지 API 호출 가능 |
| 권한 변경 | 즉시 반영 | 토큰 내 클레임이 만료까지 유지 |

access token 만료 시간을 짧게(5~15분) 설정하여 위험 노출 구간을 줄일 수 있지만, 그 시간 동안은 여전히 노출된다.

## 보완 전략

### 1. 블랙리스트 (Denylist)

무효화된 토큰만 등록하고, 매 요청마다 블랙리스트에 없는지 확인하는 방식이다.

```
로그인 시:
  access token 발급 (일반적인 JWT)
  저장소에는 아무것도 저장하지 않음

매 요청 시:
  1. access token 서명 + 만료 검증
  2. 저장소 조회: EXISTS blacklist:{jti}
  3. 없으면 → 통과, 있으면 → 거부

로그아웃 시:
  SET blacklist:{jti} 1 EX {남은 만료시간}
  → 만료 시점까지만 보관 (만료된 토큰은 JWT 검증에서 걸리므로 영구 보관 불필요)
```

블랙리스트에 등록되는 시점:

| 시점 | 동작 |
|---|---|
| 로그아웃 | 현재 access token의 jti를 등록 |
| 비밀번호 변경 | 해당 사용자의 기존 토큰을 등록 |
| 관리자 강제 차단 | 해당 사용자의 토큰을 등록 |

**한계**: 등록 전까지는 탈취된 토큰이 유효하다. 이상 행동을 감지하기 전까지 서비스가 위험에 노출된다.

### 2. Allowlist (세션 ID)

유효한 세션만 허용하는 방식이다. access token에 세션 ID를 포함하거나, HTTPOnly 쿠키로 별도 전달한다.

```
로그인 시:
  1. access token 발급 (JWT에 sessionId 클레임 포함)
  2. 저장소에 세션 저장: SET session:{sessionId} {uid, role, ...} EX {TTL}

매 요청 시:
  1. access token에서 sessionId 추출 (JWT 서명 검증)
  2. 저장소 조회: GET session:{sessionId}
  3. 존재하면 → 통과, 없으면 → 거부

로그아웃 시:
  DEL session:{sessionId} → 즉시 무효화
```

access token에 세션 ID를 포함하면 XSS로 access token 탈취 시 세션 ID도 함께 노출된다. 세션 ID를 HTTPOnly 쿠키로 분리하면 이를 방어할 수 있지만, 별도 세션 체계를 구축해야 한다.

### 3. Refresh Token 서버 측 검증

매 요청마다 refresh token을 서버 저장소의 값과 대조하는 방식이다. refresh token이 세션 ID 역할을 겸한다.

```
로그인 시:
  1. access token + refresh token 발급
  2. DB에 refresh token 저장

매 요청 시:
  1. access token 서명 + 만료 검증
  2. refresh token (HTTPOnly 쿠키)을 DB 저장값과 대조
  3. 일치하면 → 통과, 불일치하면 → 거부

로그아웃 시:
  DB에서 refresh token 삭제 → 즉시 무효화
```

refresh token은 HTTPOnly 쿠키에 저장되므로 XSS로 접근할 수 없다. access token이 탈취되어도 refresh token 없이는 API 호출이 불가능하다. Token Rotation 적용 시 갱신마다 자동으로 세션 키가 변경되어 replay 방어가 내장된다.

**trade-off**: refresh token이 JWT이므로 매 요청마다 파싱 + 서명 검증 오버헤드가 추가된다. 세션 ID는 단순 문자열이라 이 비용이 없다.

## 전략 비교

### 보안 비교

| 항목 | 블랙리스트 | Allowlist (세션 ID) | Refresh Token 검증 |
|---|---|---|---|
| 즉시 무효화 | 등록 후 가능 | 삭제 즉시 | 삭제 즉시 |
| 감지 전 위험 노출 | 있음 (등록 전까지) | 없음 | 없음 |
| XSS 탈취 시 | access token으로 API 호출 가능 | access token에 세션 ID 포함 시 호출 가능 | access token만으로 호출 불가 (HTTPOnly 쿠키 필요) |
| 저장소 장애 시 | 모든 요청 통과 (위험) | 모든 요청 거부 (안전) | 모든 요청 거부 (안전) |

### 구현/운영 비교

| 항목 | 블랙리스트 | Allowlist (세션 ID) | Refresh Token 검증 |
|---|---|---|---|
| 저장소 데이터 | 무효화된 토큰 수 (보통 적음) | 활성 세션 수 | 활성 세션 수 |
| 조회 비용 | EXISTS 조회 | GET 조회 | JWT 파싱 + GET 조회 |
| 전체 강제 로그아웃 | 개별 토큰 등록 필요 (복잡) | 해당 uid 세션 전체 삭제 | DB에서 해당 uid 삭제 |
| 추가 인프라 | 없음 (기존 토큰에 jti 추가) | 세션 저장소 + ID 체계 구축 | 없음 (기존 refresh token 활용) |

### 적합한 서비스 유형

| 전략 | 적합한 경우 | 부적합한 경우 |
|---|---|---|
| 블랙리스트 | 무효화가 드문 서비스, 읽기 위주 API | 즉시 차단이 중요한 서비스 (금융, 결제) |
| Allowlist (세션 ID) | 세션 관리가 핵심인 서비스, 멀티 디바이스 관리 | 세션 인프라 구축 부담이 큰 소규모 서비스 |
| Refresh Token 검증 | 추가 인프라 없이 세션 무효화가 필요한 서비스 | 초저지연이 요구되는 대규모 서비스 |

## 이 프로젝트의 선택

이 프로젝트는 **Refresh Token 서버 측 검증** 방식을 채택했다. AuthGuard에서 매 요청마다 access token과 refresh token을 모두 검증한다.

선택 이유:

- 기존 `UserAuthEntity.refreshToken` 필드를 활용하여 **추가 스키마 변경 없이** 세션 검증 구현
- HTTPOnly 쿠키 기반으로 XSS에 대한 **추가 방어 계층** 확보
- Token Rotation 적용으로 **replay 방어 내장**

현재 한계와 향후 개선:

- 현재 매 요청마다 DB를 직접 조회하여 성능 부담이 존재
- 향후 cache-aside 패턴(Redis) 적용으로 조회 성능 개선 계획 — 적용 시 Redis 세션 방식과 실질적 성능 차이가 미미해짐
