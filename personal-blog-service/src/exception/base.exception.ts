import { ErrorCode } from 'src/constant/error-code.enum';

export abstract class BaseException extends Error {
  readonly errorCode: ErrorCode;
  readonly message: string;
  readonly value?: string;

  constructor(errorCode: ErrorCode, message: string, value?: string) {
    super(message);

    this.errorCode = errorCode;
    this.message = message;
    this.value = value;
  }
}
