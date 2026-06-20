import { ErrorCode } from '../../constant/error-code.enum';
import { BaseException } from '../base.exception';

export class IdempotencyInProgressException extends BaseException {
  constructor(
    message = 'A request with the same Idempotency-Key is in progress.',
  ) {
    super(ErrorCode.IDEMPOTENCY_IN_PROGRESS, message);
  }
}
