import { ErrorCode } from '../constant/error-code.enum';
import { JwtDto } from '../user/dto/jwt.dto';
import { BaseException } from './base.exception';

export class TokenReissuedException extends BaseException {
  readonly jwtDto: JwtDto;

  constructor(errorCode: ErrorCode, message: string, jwtDto: JwtDto) {
    super(errorCode, message);
    this.jwtDto = jwtDto;
  }
}
