import { ErrorCode } from '../../constant/error-code.enum';
import { BaseException } from '../base.exception';

export class PostLikeNotFoundException extends BaseException {
  constructor() {
    super(ErrorCode.POST_LIKE_NOT_FOUND, 'Post like not found.');
  }
}
