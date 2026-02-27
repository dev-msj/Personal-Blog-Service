import { ErrorCode } from '../../constant/error-code.enum';
import { BaseException } from '../base.exception';

export class AuthInvalidRefreshTokenException extends BaseException {
  constructor(context?: string) {
    super(
      ErrorCode.AUTH_INVALID_REFRESH_TOKEN,
      context ?? 'Invalid refresh token.',
    );
  }
}
