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

    const result = this.encryptObject(data);

    // 배열 프로퍼티 내 객체 항목들의 @EncryptField 필드를 암호화
    for (const key of Object.keys(result)) {
      if (Array.isArray(result[key])) {
        result[key] = result[key].map((item) =>
          typeof item === 'object' && item !== null
            ? this.encryptObject(item)
            : item,
        );
      }
    }

    return result;
  }

  private encryptObject(obj: any): any {
    if (!obj || !obj.constructor) return obj;

    const fields: string[] =
      Reflect.getMetadata(ENCRYPT_FIELD_KEY, obj.constructor) || [];

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
