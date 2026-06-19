# Work Handover

## 기본 정보

- 이슈: #117
- 브랜치: feature/117-user-table-entity
- 분류: 심층
- 보안: 비해당
- worktree: .claude/worktrees/feature-117-user-table-entity

## 컨텍스트 (B2)

### 핵심 발견

- lowercase snake_case 스키마 채택: 신규 user 테이블은 data-design.md §user [확정]의 lowercase `user_id`/`created_datetime`/`modified_datetime`를 사용한다. 기존 레거시 엔티티(USER_AUTH 등)의 UPPERCASE 컬럼명을 의도적으로 미계승. Entity `@Column({ name })`에 명세 케이스 문자열을 명시 부여.
- bigint → string 매핑: `@PrimaryGeneratedColumn('increment', { type: 'bigint' })`의 필드 타입은 `string`으로 선언. TypeORM이 bigint를 정밀도 손실 방지를 위해 JS string으로 매핑하기 때문 (number 선언 시 큰 값 정밀도 손실).
- DATETIME(3) 일관: `precision: 3` 명시. data-design.md §user / implementation-guide §6.1 / 단계 1 3개 앵커 [확정] 일관.
- migration:generate 미실행 → 형식 동등 수동 작성: 병렬 모드 테스트 정책(DB 접근 금지, 다른 implementer와 충돌 방지) + 워크트리에 dev env 파일 부재(gitignore 대상)로 `migration:generate`를 실행할 수 없음. generate 산출은 엔티티 메타데이터 → DDL 결정론적이므로, InitialSchema(1777453897802) generate 산출 형식(백틱 이스케이프, `datetime(N)` precision 표기, `DEFAULT CURRENT_TIMESTAMP(N)` / `ON UPDATE CURRENT_TIMESTAMP(N)`, bigint AUTO_INCREMENT PK, ENGINE=InnoDB)을 그대로 따라 user CREATE 단일 구문 + DROP down()을 수동 작성. 레거시 diff 혼입 없음.
- 컨테이너 검증 직렬 대기: up/down 실제 적용 + E2E globalSetup 그린 회귀는 오케스트레이터가 복귀 후 직렬 수행. 본 implementer는 `npm run build`(tsc) 컴파일 통과로만 코드 정합성 검증.

### 적용 검증 요건

- B4 TDD 면제: Entity는 순수 메타데이터, Service/Repository 미신설 → 단위 테스트 불요. 코드 정합성은 tsc 빌드로 검증.
- B5 에이전트(심층 + 보안 비해당 → work-analyzer + test-analyzer): 오케스트레이터 책임.
- B6 문서화: 3채널 해당 없음 (아래 결정 로그/의도적 제외 참조).

### MCPSI 참조

- Solution: docs/solution/phase-1/data-migration.md §단계 1
- Solution: docs/solution/common/data-design.md §user
- Solution: docs/solution/common/application-arch.md §User Aggregate (Aggregate Root)
- Implementation: docs/implementation/implementation-guide.md §6.1 §6.2
- Flow: 없음 (Entity 신설만, 흐름 변경 없음)
- Phase: 1

## 계획 (B3)

- [x] 작업 1 — UserEntity 신설 (src/user/entities/user.entity.ts): @Entity('user'), PK + 타임스탬프 3컬럼만. @PrimaryGeneratedColumn('increment', { name:'user_id', type:'bigint' }) → string, @CreateDateColumn(created_datetime, datetime, precision:3), @UpdateDateColumn(modified_datetime, datetime, precision:3). 관계 매핑 신설 금지.
- [x] 작업 2 — CreateUserTable migration (src/migrations/1781912043621-CreateUserTable.ts): user 테이블 CREATE 단일 구문 + down() DROP TABLE. 클래스명 CreateUserTable1781912043621 + name 프로퍼티 일치 (InitialSchema 패턴 준수). generate 미실행 사유는 핵심 발견 참조.
- [x] 작업 3 — UserModule registerEntities (src/user/user.module.ts): TypeOrmModule.forFeature 배열에 UserEntity 추가. providers 변경 없음.
- [x] 작업 4 — 정합성 검증: `npm run build` tsc 컴파일 통과 + 변경 3파일 eslint 통과. 컨테이너 up/down 실제 적용은 오케스트레이터 직렬 수행 대기.

## 결정 로그

- [B3] lowercase snake_case 스키마 채택
  - context: 신규 user 테이블 컬럼명 케이스 결정. 기존 레거시 엔티티는 UPPERCASE.
  - facing: 레거시 일관성(UPPERCASE 계승) vs data-design.md §user [확정] 명세(lowercase).
  - decided: data-design.md §user [확정]의 lowercase snake_case 부여. 레거시 UPPERCASE 미계승.
  - accepting: 같은 user 모듈 내 케이스 혼재가 일시적으로 발생하나, [확정] 명세 우선 + Phase 1 마이그레이션 시리즈가 레거시를 점진 교체하므로 수용.
- [B3] bigint PK 필드 타입 string 선언
  - context: BIGINT AUTO_INCREMENT PK의 TypeScript 필드 타입 결정.
  - facing: 가독성 위주 number 선언 vs TypeORM bigint 매핑 규약(string).
  - decided: 필드 타입 string. TypeORM bigint 컬럼은 JS string으로 매핑.
  - accepting: number였다면 2^53 초과 user_id에서 정밀도 손실 발생. string 선언으로 회피, 후속 FK 참조 코드도 string 기준 작성 필요.
- [B2] migration:generate 미실행, 형식 동등 수동 작성
  - context: 병렬 모드 + dev env 부재로 DB 연결 불가, generate 실행 불능.
  - facing: 정책 위반 감수(컨테이너 접근) vs generate 산출 형식을 결정론적으로 수동 재현.
  - decided: InitialSchema generate 산출 형식을 그대로 따라 수동 작성. raw 임의 작성 아님(generate 관행 정합).
  - accepting: 컨테이너 up/down 실제 적용 검증은 오케스트레이터 직렬 단계로 이연. tsc 빌드로 코드 정합성만 선검증.

## 의도적 제외

- 역관계 매핑(@OneToMany/@OneToOne 등): 대상 엔티티가 아직 uid PK라 FK 불일치 → 빌드 깨짐 방지. 후속 #121/#122/#154/#155.
- Tables.USER 추가 (test/utils/db-cleaner.ts): #118 이후. 본 이슈 비대상.
- 컨테이너 가역성 검증 (up/down 실제 적용, E2E globalSetup 그린 회귀): 오케스트레이터 직렬 수행. 테스트 컨테이너(MySQL 3307/Redis 6380) 싱글톤 + E2E maxWorkers:1로 병렬 implementer 간 충돌 방지.
- TC-90 가역성: 단계 2/4/5 전용으로 #117 비대상.
- CLAUDE.md Database Entities 갱신: 과도 수정 지양. CLAUDE.md가 이미 "Phase 1에서 user/... 구조로 전면 재설계 예정"으로 예고 + "Phase 1 이후는 계획이며 코드에 아직 반영되지 않음" 기술. 단일 엔티티(역관계 없음) 추가만으로 재설계 완료가 아니므로 시리즈 완료 시점에 일괄 갱신이 적절.

## 컨테이너 검증

- 상태: 오케스트레이터 직렬 수행 대기.
- 항목: (1) `npm run migration:run` → user 테이블 생성 확인, (2) `npm run migration:revert` → DROP 가역성 확인, (3) `npm run test:e2e` globalSetup runMigrations 그린 회귀.
- 본 implementer 수행 검증: `npm run build`(tsc) 통과 + 변경 3파일 eslint 통과.
