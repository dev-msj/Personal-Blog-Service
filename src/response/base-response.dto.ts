import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constant/error-code.enum';

export abstract class BaseResponse {
  readonly code: number;
  readonly message: string;

  constructor(code: HttpStatus | ErrorCode, message: string) {
    this.code = code;
    this.message = message;
  }
}
