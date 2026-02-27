import { ErrorCode } from '../../constant/error-code.enum';
import { BaseException } from '../base.exception';

export class UserNotFoundException extends BaseException {
  constructor(uid: string) {
    super(ErrorCode.USER_NOT_FOUND, `User does not exist. - [${uid}]`);
  }
}
