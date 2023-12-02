import { HttpStatus } from '@nestjs/common';
import { BaseResponse } from './base-response.dto';
import { UnexpectedCodeException } from '../exception/unexpected-code.exception';

export class FailureResponse extends BaseResponse {
  constructor(code: HttpStatus, message: string) {
    super(code, message);

    this.checkCodeOk(this.code);
  }

  private checkCodeOk(code: HttpStatus) {
    if (code === HttpStatus.OK) {
      throw new UnexpectedCodeException(
        ErrorCode.NOT_ACCEPTABLE,
        '"HttpStatus.OK" is not allowed in FailureResponse!',
        HttpStatus.OK.toString(),
      );
    }
  }
}
