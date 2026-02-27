import { ErrorCode } from '../../constant/error-code.enum';
import { BaseException } from '../base.exception';

export class AuthInvalidOauthTokenException extends BaseException {
  constructor(detail?: string) {
    super(ErrorCode.AUTH_INVALID_OAUTH_TOKEN, detail ?? 'Invalid OAuth token.');
  }
}
