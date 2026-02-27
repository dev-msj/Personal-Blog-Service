import { ErrorCode } from '../../constant/error-code.enum';
import { BaseException } from '../base.exception';

export class AuthUnauthorizedException extends BaseException {
  constructor(context?: string) {
    super(ErrorCode.AUTH_UNAUTHORIZED, context ?? 'Unauthorized');
  }
}
