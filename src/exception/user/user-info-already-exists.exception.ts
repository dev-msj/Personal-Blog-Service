import { ErrorCode } from '../../constant/error-code.enum';
import { BaseException } from '../base.exception';

export class UserInfoAlreadyExistsException extends BaseException {
  constructor(uid: string) {
    super(
      ErrorCode.USER_INFO_ALREADY_EXISTS,
      `UserInfo already exists. - [${uid}]`,
    );
  }
}
