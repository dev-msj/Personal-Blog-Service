import { HttpStatus } from '@nestjs/common';

export abstract class BaseResponse {
  readonly code: number;
  readonly message: string;

  constructor(code: HttpStatus, message: string) {
    this.code = code;
    this.message = message;
  }
}
