import { ErrorCode } from 'src/constant/error-code.enum';
import { BaseException } from './base.exception';

export class UnexpectedCodeException extends BaseException {
  constructor(errorCode: ErrorCode, message: string, value?: string) {
    super(errorCode, message, value);
  }
}
