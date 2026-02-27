import { ErrorCode } from '../../constant/error-code.enum';
import { BaseException } from '../base.exception';

export class AuthRefreshTokenRequiredException extends BaseException {
  constructor() {
    super(ErrorCode.AUTH_REFRESH_TOKEN_REQUIRED, 'Refresh token is required.');
  }
}
