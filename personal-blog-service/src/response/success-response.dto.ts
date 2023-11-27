import { HttpStatus } from '@nestjs/common';
import { BaseResponse } from './base-response.dto';

export class SuccessResponse extends BaseResponse {
  constructor() {
    super(HttpStatus.OK, 'Success!');
  }
}
