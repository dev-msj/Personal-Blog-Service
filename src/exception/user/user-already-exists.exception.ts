import { ErrorCode } from '../../constant/error-code.enum';
import { BaseException } from '../base.exception';

export class UserAlreadyExistsException extends BaseException {
  constructor(uid: string) {
    super(ErrorCode.USER_ALREADY_EXISTS, `User already exists. - [${uid}]`);
  }
}
