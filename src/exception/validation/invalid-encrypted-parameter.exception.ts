import { ErrorCode } from '../../constant/error-code.enum';
import { BaseException } from '../base.exception';

export class InvalidEncryptedParameterException extends BaseException {
  constructor() {
    super(
      ErrorCode.INVALID_ENCRYPTED_PARAMETER,
      'Invalid encrypted parameter.',
    );
  }
}
