import { ErrorCode } from '../constant/error-code.enum';
import { BaseException } from './base.exception';

export class InvalidPageException extends BaseException {
  constructor(page: number) {
    super(
      ErrorCode.INVALID_PAGE,
      `Invalid page number: ${page}. Page must be >= 1`,
      String(page),
    );
  }
}
