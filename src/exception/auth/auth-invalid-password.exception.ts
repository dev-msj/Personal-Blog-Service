import { ErrorCode } from '../../constant/error-code.enum';
import { BaseException } from '../base.exception';

export class AuthInvalidPasswordException extends BaseException {
  constructor() {
    super(ErrorCode.AUTH_INVALID_PASSWORD, 'Password does not match.');
  }
}
