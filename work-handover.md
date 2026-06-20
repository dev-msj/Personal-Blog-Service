# work-handover — 이슈 #132 Idempotency-Key Interceptor

## 기본 정보

- 이슈: #132 (API 수신 측 Idempotency-Key 인터셉터)
- 브랜치: feature/132-idempotency-interceptor
- 분류: 심층 (cross-cutting 전역 인터셉터 + Redis race + DT-1 4분기 + 상태 전이)
- 보안: 비해당 (신뢰성/정확성 관심사. AuthGuard 후행 위치로 미인증 캐시 오염 불가, 키 네임스페이스 idempotency:{user_id}:{key}, UUID v4 강제, pending Lua 원자 락)
- worktree: .claude/worktrees/feature-132-idempotency-interceptor
- 모드: work-parallel implementer (Agent 도구 없음, 리뷰/머지 미수행)

## 컨텍스트 (B2)

핵심 발견 (비자명):
1. HTTP 200 불일치 해소: security.md §8.3 / async-deployment.md는 pending(R4) 응답을 "409 Conflict"로 기술하나, AbstractExceptionFilter가 모든 실패를 HTTP 200 + FailureResponse로 통일 변환(429조차)하는 프로젝트 규약([확정])과 충돌. flow §3.2가 코드 규약과 정합한 최신 결정 → HTTP 200 + FailureResponse(IDEMPOTENCY_IN_PROGRESS=90009) + Retry-After:5 헤더로 구현. 409 경로 미생성. (오케스트레이터 [B3] 확정)
2. Lua 원자 락: setPending은 SET NX EX를 단일 Lua eval로 실행(SETNX+EXPIRE 2-command 분리 시 크래시로 TTL 없는 영구 키 잔존 위험). RedisThrottlerStorage의 Lua 원자성 패턴과 일관.
3. 캐싱 시점: 전역 APP_INTERCEPTOR는 컨트롤러 레벨 EncryptPrimaryKeyInterceptor보다 바깥이라 암호화된 최종 직렬화 응답을 캐싱(Phase 5 AES-GCM 안전). next.handle() 결과를 setCompleted로 캐싱.
4. 컨테이너 검증 직렬 대기: 실 Redis(6380)/MySQL(3307)는 호스트 공유 싱글톤 + E2E maxWorkers:1. 병렬 implementer가 동시 실행 시 충돌하므로 contract/통합/동시성 스위트는 작성만 하고 실행은 오케스트레이터가 복귀 후 직렬 수행.
5. authUserId = request.headers['authenticatedUser'] (AuthGuard 주입 신뢰값, 현재 string — TP5 전). 부재(미인증/@Public) 시 R1 처리(Redis 미접근, 캐싱 없음). guide §3.14의 userId: bigint 시그니처는 TP5 후 의미이며 현 구현은 string으로 진행(B3 기술결정 4).

적용 검증 요건:
- B4: 심층 → TDD. 단위 가능 영역(인터셉터 DT-1 분기, Service, PBT)은 Red-Green 적용 후 커밋.
- B5(오케스트레이터): work-analyzer + test-analyzer. 컨테이너 검증 직렬 수행 포함.
- B6: 3채널 점검 완료 (아래 B6 내역).

### MCPSI 참조 블록 (이슈 본문)

- Solution: docs/solution/phase-1/async-deployment.md
- Solution: docs/solution/common/security.md §8
- Solution: docs/solution/common/application-arch.md §Idempotency Key Pattern [확정]
- Solution: docs/problem/domain-spec.md §DT-1
- Implementation: docs/implementation/implementation-guide.md §4.2 §6.5 §7.1
- Flow: idempotency-key-handle
- Phase: 1

## 계획 (B3) 체크리스트

- [x] 1. ErrorCode IDEMPOTENCY_IN_PROGRESS=90009 추가
- [x] 2. @SkipIdempotency 데코레이터 + spec
- [x] 3. IdempotencyService (get/setPending/setCompleted, SET NX EX Lua) + 단위 spec(ioredis mock)
- [x] 4. IdempotencyModule (RedisModule import, Service export)
- [x] 5. IdempotencyKeyInterceptor (DT-1 R1~R4 + method/path + UUID v4 + Retry-After) + 단위 spec
- [x] 6. 전역 등록 (app.module.ts APP_INTERCEPTOR + IdempotencyModule import)
- [x] 7. @SkipIdempotency 부착 (login/refresh/oauth, join 제외)
- [x] 8. fast-check devDependency (package.json + package-lock.json 수동 편집, node_modules 미오염)
- [x] 9. PBT TC-IDEM-08 (RuleBasedStateMachine absent→pending→completed 단방향) — 실행 green
- [x] 10. 단위 TC-IDEM-02/07 (R1 즉시 next, non-UUID v4 → BAD_REQUEST) — 실행 green
- [x] 11. 계약 TC-IDEM-01/03/05/06 (test/idempotency-contract.e2e-spec.ts) — 작성만, 실행 안 함
- [x] 12. 통합 TC-IDEM-04 + 동시성 (test/idempotency-integration.e2e-spec.ts) — 작성만, 실행 안 함

## 결정 로그

### [B3] pending(R4) 응답 HTTP 상태 — HTTP 200 + IDEMPOTENCY_IN_PROGRESS (Y-Statement)

- 맥락(In the context of): API 수신 측 Idempotency-Key 처리에서 진행 중(pending) 동일 키 재요청 응답 형태 결정.
- 직면(facing): security.md §8.3 / async-deployment.md는 "409 Conflict + Retry-After"라 기술하나, 본 프로젝트 AbstractExceptionFilter는 모든 실패를 HTTP 200 + FailureResponse로 통일 변환([확정] HTTP Response Convention, 429도 200).
- 결정(we decided for): HTTP 200 + FailureResponse(IDEMPOTENCY_IN_PROGRESS=90009) + Retry-After:5 헤더. 409 코드 경로 미생성. flow §3.2가 코드 규약과 정합한 최신 결정.
- 기각(and neglected): 409 Conflict 직접 반환(필터 우회/수정 필요 — HTTP 컨벤션 [확정] 위반).
- 결과(to achieve / accepting): 응답 컨벤션 일관성 확보. Retry-After는 필터가 미지원하므로 인터셉터가 res.setHeader로 직접 설정(throw 아닌 of() 직접 반환). security.md §8.3 문구와 코드가 표면적으로 불일치하나 flow §3.2 + CLAUDE.md가 authoritative. (오케스트레이터 사전 확정 결정 수용)

### [B4] setPending 원자 락 — SET NX EX 단일 Lua eval

- SETNX + EXPIRE 2-command 분리 금지(두 명령 사이 크래시 시 TTL 없는 영구 키 잔존). RedisThrottlerStorage Lua 원자성 패턴과 일관. acquired=false(키 존재) → R4 식별에 활용(동시 요청 race 단일 획득 보장).

### [B4] 캐싱 시점 — next.handle() 최종 직렬화 응답

- 전역 APP_INTERCEPTOR는 컨트롤러 레벨 EncryptPrimaryKeyInterceptor보다 바깥(NestJS 인터셉터 중첩) → 암호화 후 최종 응답을 캐싱. R3 재반환 시 동일 직렬화 형태 보장(Phase 5 AES-GCM 안전).

### [B4] setCompleted 시그니처 확장 — method/path 추가 (guide §3.14 [가이드] 항목)

- guide §3.14는 setCompleted(userId, key, statusCode, body)로 명세하나, completed 레코드가 method/path를 보존하지 않으면 SET 덮어쓰기 시 R3 재반환/§3.1 키 충돌 검증에 필요한 method/path가 소실됨. §3.14는 [가이드](구현 세부)이므로 setCompleted(userId, key, method, path, statusCode, body)로 확장. 동작 의미는 flow §2.2/§3.1과 정합(개선).

### [B4] 핸들러 throw 시 — pending TTL 자연 만료 폴백 (flow §3.3 부분 채택)

- flow §3.3은 "BaseExceptionFilter가 변환한 실패 응답을 Interceptor가 수신 → completed 캐싱"을 이상으로 기술하나, NestJS에서 ExceptionFilter는 인터셉터 스트림 바깥에서 실행되어 인터셉터가 변환된 응답을 직접 수신하지 못함(catchError로 error를 받을 뿐). B3 작업 5 범위는 DT-1 R1~R4 + method/path + UUID + Retry-After로, 실패 응답 캐싱은 명시 비포함. 따라서 throw 시 pending 키를 24h TTL로 자연 만료시키는 폴백 채택(flow §3.3 마지막 문단이 명시 허용: "pending → completed 전환 실패 시 24h TTL 자연 만료"). 재요청은 R4(IN_PROGRESS)로 진입. 실패 응답 completed 캐싱이 요구되면 인터셉터 catchError 보강 필요 — 오케스트레이터 컨테이너 검증(TC-IDEM-06) 후 판단 권고.

### [B5-fix] 실패 직접반환 of()→throw 전환 (오케스트레이터 컨테이너 검증 결함 1건) — Y-Statement

- 맥락(In the context of): IdempotencyKeyInterceptor의 실패 경로(형식위반·키 충돌·R4 pending) 응답 형태.
- 직면(facing): 초기 구현은 of(new FailureResponse(...))를 정상 반환값으로 흘렸으나, 컨테이너 E2E(TC-IDEM-04)에서 reuse.status가 기대 200이 아닌 201로 관측됨. 원인: of()-반환은 NestJS가 라우트 메타데이터 status(POST=201)를 적용하고 인터셉터의 response.statusCode 설정을 덮어쓴다. 이 프로젝트의 "실패=HTTP 200" 규약은 throw → ExceptionFilter(res.status(200).json(FailureResponse)) 메커니즘으로만 달성된다(throttler 429도 throw→HttpExceptionFilter 200 변환).
- 결정(we decided for): 실패 경로를 throw로 전환. 형식위반·키 충돌 → BadRequestException(@nestjs/common, HttpExceptionFilter가 BAD_REQUEST→COMMON_BAD_REQUEST 변환). R4 pending·setPending 경합 패 → 신규 IdempotencyInProgressException extends BaseException(errorCode=90009, BaseExceptionFilter가 200+FailureResponse 변환). Retry-After:5는 throw 직전 res.setHeader로 설정(Express는 기존 헤더를 삭제하지 않아 필터의 res.status(200).json() 응답에도 보존). R2(처리·캐싱)·R3(재반환)은 of() 정상 경로 유지.
- 기각(and neglected): of(FailureResponse) 유지(규약 우회, status 201 잔존) / HttpExceptionFilter에 90009 status 매핑 추가(90009는 표준 HTTP status 없어 부자연).
- 결과(to achieve / accepting): 모든 실패 응답이 HTTP 200으로 통일, TC-IDEM-04 통과. switchMap 콜백 내 동기 throw는 RxJS가 error notification으로 변환→NestJS 필터로 전달되어 정상 동작. 신규 src/exception/idempotency/ 디렉토리 + barrel 추가(기존 도메인 예외 패턴 계승). 단위 spec은 형식위반=동기 throw(expect().toThrow), 충돌·R4=observable error(lastValueFrom().rejects.toBeInstanceOf)로 단언 전환.

### [B5-fix] 동시성 테스트 불변식 정정 — 부작용 정확히 1회 (테스트 과도 엄격) — Y-Statement

- 맥락(In the context of): idempotency-integration.e2e-spec.ts 동시성 테스트의 기대 불변식.
- 직면(facing): 초기 테스트는 "1 success + N-1 IN_PROGRESS" 고정 기대였으나 컨테이너 검증에서 success=2로 실패. 코드는 정상이며 테스트가 틀림: setPending이 Lua SET NX EX로 원자적이라 핸들러는 정확히 1회 실행되지만, 동시 N요청 중 처리 완료 후 도착분은 R4(IN_PROGRESS)가 아닌 R3(completed 재반환 = success)가 정상 멱등 동작이다. 따라서 IN_PROGRESS 개수는 타이밍에 의존하는 비결정값이다.
- 결정(we decided for): 멱등성의 진짜 불변식 "부작용 정확히 1회"로 정정(약화 아닌 강화). 핵심 단언: 버스트 후 GET /posts data length === 1(글 1건만). 부가: 모든 응답이 success(code 200) 또는 IN_PROGRESS 둘 중 하나(합 === N), success ≥ 1, 모든 success body 동일(멱등 동일 응답), 모든 IN_PROGRESS는 Retry-After:5 보유.
- 기각(and neglected): IN_PROGRESS 개수 고정 기대(타이밍 의존 비결정 단언 — flaky) / success 개수 ≤ 1 강제(R3 재반환을 실패로 오판).
- 결과(to achieve / accepting): 부작용 1회라는 멱등성 본질을 결정적으로 검증. TC-IDEM-04(키 충돌)는 코드 수정으로 reuse.status===200 통과하므로 기대값 유지(정정 불요).

## 의도적 제외

- contract(TC-IDEM-01/03/05/06) + 통합/동시성(TC-IDEM-04 + 동일 키 동시 race) 스위트: 작성만, 실행 안 함. 컨테이너 공유 싱글톤 + maxWorkers:1 race 회피. **컨테이너 검증(TC-IDEM-01/03/04/05/06 + 동시성): 오케스트레이터 직렬 수행 대기.** 파일명은 e2e testRegex(.e2e-spec.ts$)에 맞춰 test/idempotency-contract.e2e-spec.ts / test/idempotency-integration.e2e-spec.ts로 명명(B3의 test/contract/idempotency.spec.ts는 e2e 정규식 미매치 → npm run test:e2e로 발견되도록 변경).
- comment/reply 컨트롤러 @SkipIdempotency 부착: comment/reply 컨트롤러 현재 미존재(Phase 1 후속). 본 이슈 비대상(coord). 신설 시 Write 핸들러에 멱등 적용(데코레이터 불요 — 기본 적용).
- join @SkipIdempotency: 미부착(멱등 적용 유지). 단 join은 @Public이라 authUserId 부재 → 현재 R1 무캐싱 패스. TP5 후 join이 신원을 가지면 실질 멱등 적용.

## 검증 체크리스트 (B8 자기검증)

- [x] 필수 섹션 존재: 기본 정보 / 컨텍스트(B2) / 계획(B3) / 결정 로그 / 의도적 제외
- [x] [B3] HTTP200 불일치 해소 결정에 Y-Statement 4요소(맥락·직면·결정·기각·결과)
- [x] 단계 태그([B3]/[B4]) 부착
- [x] 핵심 발견 비자명(HTTP200 불일치, Lua 락, 캐싱 시점, 컨테이너 직렬 대기, throw 폴백)
- [x] MCPSI 참조 블록 복사
