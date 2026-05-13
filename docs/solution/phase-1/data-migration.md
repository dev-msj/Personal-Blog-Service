# Phase 1 Data Migration

User Aggregate 재설계의 단계별 마이그레이션 절차. common/application-arch.md §3방향 리팩토링 결정 (Refactoring Towards Patterns)의 중간 단계 절차 구현.

Phase 0에서 활성화된 migrations 인프라(synchronize:false, InitialSchema baseline)를 전제로 한다. 모든 스키마/데이터 변경은 migration 파일로 작성.

## 마이그레이션 단계

각 단계는 독립 migration 파일로 작성하여 단계별 검증 가능. 기존 데이터 손실 방지를 위해 데이터 보존형 마이그레이션 로직을 `up()` 메소드에 포함하고, `down()` 메소드에는 역방향 마이그레이션을 작성하여 롤백 가능성 확보. 커밋 단위는 migration 파일 단위(각 단계마다 하나의 커밋 + E2E 테스트 통과 보증).

### 단계 1: user 테이블 신설

```sql
CREATE TABLE user (
  user_id           BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  created_datetime  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  modified_datetime DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);
```

이 단계에서는 user 테이블만 생성. 기존 데이터에 영향 없음.

### 단계 2: user_auth 재구성 (기존 uid → login_id, user_id 추가)

```sql
-- 신규 컬럼 추가 (nullable)
ALTER TABLE user_auth
  ADD COLUMN user_id_new BIGINT NULL,
  ADD COLUMN login_id    VARCHAR(100) NULL;

-- 데이터 마이그레이션: 각 기존 row에 대해 user 레코드 생성 + user_id_new 할당
-- OAuth 사용자(socialYN='Y')는 login_id NULL 유지, 일반 가입은 기존 uid를 login_id로 이동
INSERT INTO user (created_datetime, modified_datetime)
SELECT created_datetime, modified_datetime FROM user_auth ORDER BY uid;

-- 매핑 테이블 활용 또는 user_auth.uid와 user.user_id 1:1 결합 후 user_id_new 채움
-- (구현 상세: TypeORM Migration up() 내 raw query + cursor 처리)

UPDATE user_auth ua
JOIN (SELECT u.user_id, ua_inner.uid
      FROM user u
      JOIN user_auth ua_inner ON ...) AS map ON ua.uid = map.uid
SET ua.user_id_new = map.user_id,
    ua.login_id = CASE WHEN ua.socialYN = 'N' THEN ua.uid ELSE NULL END;

-- 기존 uid PK 제거 + user_id_new를 PK로 승격
ALTER TABLE user_auth DROP PRIMARY KEY;
ALTER TABLE user_auth DROP COLUMN uid;
ALTER TABLE user_auth CHANGE COLUMN user_id_new user_id BIGINT NOT NULL PRIMARY KEY;
ALTER TABLE user_auth ADD CONSTRAINT fk_user_auth_user
  FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE;
ALTER TABLE user_auth ADD CONSTRAINT uq_login_id UNIQUE (login_id);
```

`down()`은 역방향: login_id를 uid로 옮기고 user_id 컬럼 제거.

### 단계 3: user_auth_provider 테이블 신설 + OAuth 사용자 매핑

```sql
CREATE TABLE user_auth_provider (
  provider_id       BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT NOT NULL,
  provider          ENUM('GOOGLE') NOT NULL,
  provider_subject  VARCHAR(255) NOT NULL,
  email             VARCHAR(320) NULL,
  created_datetime  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  modified_datetime DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_provider_subject UNIQUE (provider, provider_subject),
  CONSTRAINT fk_uap_user FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
);

-- 기존 OAuth 사용자(socialYN='Y' 였던 row의 user_id) 매핑
-- 기존 uid는 email이었으므로 email로 채우고 provider_subject는 초기에 email로 채움
INSERT INTO user_auth_provider (user_id, provider, provider_subject, email)
SELECT ua.user_id, 'GOOGLE', <original_uid_value>, <original_uid_value>
FROM user_auth ua
WHERE ua.login_id IS NULL;  -- OAuth 사용자
```

향후 OAuth 로그인 시점에 `provider_subject`를 실제 Google `sub` 클레임으로 lazy 업데이트하거나 별도 보정 스크립트 실행 (학습 프로젝트 단순성 허용).

### 단계 4: user_info 외래키 변경

```sql
ALTER TABLE user_info ADD COLUMN user_id_new BIGINT NULL;

UPDATE user_info ui
JOIN user_auth ua ON <기존 uid 매핑>
SET ui.user_id_new = ua.user_id;

ALTER TABLE user_info DROP PRIMARY KEY;
ALTER TABLE user_info DROP COLUMN uid;
ALTER TABLE user_info CHANGE COLUMN user_id_new user_id BIGINT NOT NULL PRIMARY KEY;
ALTER TABLE user_info ADD CONSTRAINT fk_user_info_user
  FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE;
```

### 단계 5: post / post_like 외래키 변경

```sql
-- post.post_uid → post.user_id
ALTER TABLE post ADD COLUMN user_id BIGINT NULL;

UPDATE post p
JOIN user_auth ua ON <기존 post_uid → ua.user_id 매핑>
SET p.user_id = ua.user_id;

ALTER TABLE post MODIFY COLUMN user_id BIGINT NOT NULL;
ALTER TABLE post DROP COLUMN post_uid;
ALTER TABLE post ADD CONSTRAINT fk_post_user
  FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE;

-- post_like.uid → post_like.user_id (복합 PK 영향 처리)
ALTER TABLE post_like ADD COLUMN user_id BIGINT NULL;
UPDATE post_like pl JOIN user_auth ua ON pl.uid = <매핑> SET pl.user_id = ua.user_id;
ALTER TABLE post_like DROP PRIMARY KEY;
ALTER TABLE post_like DROP COLUMN uid;
ALTER TABLE post_like MODIFY COLUMN user_id BIGINT NOT NULL;
ALTER TABLE post_like ADD PRIMARY KEY (post_id, user_id);
ALTER TABLE post_like ADD CONSTRAINT fk_pl_user
  FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE;
```

### 단계 6: post에 커서 페이징 인덱스 추가

```sql
CREATE INDEX idx_post_cursor ON post (write_datetime DESC, post_id DESC);
CREATE INDEX idx_post_user ON post (user_id, write_datetime DESC, post_id DESC);
```

### 단계 7: comment / reply 테이블 신설

```sql
CREATE TABLE comment (
  comment_id        BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  post_id           BIGINT NOT NULL,
  user_id           BIGINT NOT NULL,
  content           VARCHAR(1000) NOT NULL,
  created_datetime  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  modified_datetime DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_comment_post FOREIGN KEY (post_id) REFERENCES post(post_id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_user FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
  INDEX idx_comment_post_cursor (post_id, created_datetime ASC, comment_id ASC)
);

CREATE TABLE reply (
  reply_id          BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  comment_id        BIGINT NOT NULL,
  user_id           BIGINT NOT NULL,
  content           VARCHAR(1000) NOT NULL,
  created_datetime  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  modified_datetime DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_reply_comment FOREIGN KEY (comment_id) REFERENCES comment(comment_id) ON DELETE CASCADE,
  CONSTRAINT fk_reply_user FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
  INDEX idx_reply_comment (comment_id, created_datetime ASC, reply_id ASC)
);
```

## 마이그레이션 안전성

- 각 단계는 backwards-compatible 컬럼 추가 → 데이터 이동 → 기존 컬럼/PK 제거 순서로 작성하여 중간 실패 시 데이터 무결성 보존
- `down()` 메소드에 역방향 로직 작성 (단, 7단계 신설 테이블은 down에서 DROP)
- 단계 2, 3, 4, 5는 데이터 보존형 마이그레이션으로 기존 데이터 양만큼 SELECT/UPDATE 실행. 학습 프로젝트는 데이터 양이 적어 단일 트랜잭션 처리 가능
- E2E 테스트는 globalSetup에서 모든 migration을 실행한 뒤 신규 스키마 기준으로 동작 확인

## Redis 키 구조 (Phase 1 도입, 외부 저장소)

본 단계 진행과 별도로 Phase 1에서 Redis에 다음 키가 신규 사용된다 (스키마 레이어 책임이나 외부 저장소이므로 DDL 없음):

- `login_fail:{loginId}` — 로그인 실패 카운터. TTL 15분. 정책 primary: ../common/security.md §7
- `idempotency:{user_id}:{idempotency_key}` — API 수신 Idempotency 응답 캐시. TTL 24시간. 정책 primary: ../common/security.md §8

## Sources

- ../common/data-design.md §스키마 (최종 형상) — 목표 스키마
- ../common/application-arch.md §3방향 리팩토링 결정 (Refactoring Towards Patterns)
- ../common/security.md §7 (로그인 실패 카운트) / §8 (API Idempotency-Key)
- Fowler "Expand-Contract" 리팩토링 패턴
