import { ErrorCode } from '../constant/error-code.enum';

export abstract class BaseException extends Error {
  readonly errorCode: ErrorCode;
  readonly message: string;
  readonly value?: string;

  constructor(errorCode: ErrorCode, message: string, value?: string) {
    super();

    this.errorCode = errorCode;
    this.message = message;
    this.value = value;
  }
}
