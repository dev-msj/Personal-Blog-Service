import { ErrorCode } from '../../constant/error-code.enum';
import { BaseException } from '../base.exception';

export class PostNotFoundException extends BaseException {
  constructor(postId: number) {
    super(ErrorCode.POST_NOT_FOUND, `Post does not exist. - [${postId}]`);
  }
}
