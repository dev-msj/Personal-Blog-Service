import { ErrorCode } from '../../constant/error-code.enum';
import { BaseException } from '../base.exception';

export class PostLikeAlreadyExistsException extends BaseException {
  constructor() {
    super(ErrorCode.POST_LIKE_ALREADY_EXISTS, 'Post like already exists.');
  }
}
