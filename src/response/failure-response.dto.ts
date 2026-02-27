import { BaseResponse } from './base-response.dto';
import { ErrorCode } from '../constant/error-code.enum';

export class FailureResponse extends BaseResponse {
  constructor(code: ErrorCode, message: string) {
    super(code, message);
  }
}
