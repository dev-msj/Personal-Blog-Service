import { ErrorCode } from '../../constant/error-code.enum';
import { BaseException } from '../base.exception';

export class UserInfoNotFoundException extends BaseException {
  constructor(uid: string) {
    super(ErrorCode.USER_INFO_NOT_FOUND, `User does not exist! - [${uid}]`);
  }
}
