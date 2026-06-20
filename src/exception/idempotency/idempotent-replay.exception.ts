import { ErrorCode } from '../../constant/error-code.enum';
import { BaseException } from '../base.exception';

/**
 * 캐싱된 실패 응답(completed, failed=true)의 동일 재반환용 예외 (flow §3.3 R3).
 *
 * 핸들러 throw로 캐싱된 errorCode/message를 그대로 재구성하여 throw한다.
 * BaseExceptionFilter가 errorCode → HTTP 200 + FailureResponse로 변환하므로
 * 최초 실패와 동일한 응답이 재생산된다(of() 직접반환은 라우트 status를 적용해
 * 실패 200을 만들 수 없어 throw 재구성을 사용한다).
 */
export class IdempotentReplayException extends BaseException {
  constructor(errorCode: ErrorCode, message: string) {
    super(errorCode, message);
  }
}
