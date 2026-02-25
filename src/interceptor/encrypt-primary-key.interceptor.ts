import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import authConfig from '../config/authConfig';
import { CryptoUtils } from '../utils/crypto.utils';
import { ENCRYPT_FIELD_KEY } from '../decorator/encrypt-field.decorator';

@Injectable()
export class EncryptPrimaryKeyInterceptor implements NestInterceptor {
  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.encryptResponse(data)));
  }

  private encryptResponse(data: any): any {
    if (!data) return data;

    // data 배열을 가진 래퍼(PaginationDto 등)는 배열 내 항목을 암호화
    if (data.data && Array.isArray(data.data)) {
      return {
        ...data,
        data: data.data.map((item) => this.encryptObject(item)),
      };
    }

    return this.encryptObject(data);
  }

  private encryptObject(obj: any): any {
    if (!obj || !obj.constructor) return obj;

    const fields: string[] =
      Reflect.getMetadata(ENCRYPT_FIELD_KEY, obj.constructor) || [];
    if (fields.length === 0) return obj;

    const result = { ...obj };
    for (const field of fields) {
      if (result[field] !== undefined && result[field] !== null) {
        result[field] = CryptoUtils.encryptPrimaryKey(
          String(result[field]),
          this.config.pkSecretKey,
        );
      }
    }

    return result;
  }
}
