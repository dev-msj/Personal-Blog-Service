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

    if (data.data && Array.isArray(data.data)) {
      data.data = data.data.map((item) => this.encryptObject(item));
      return data;
    }

    return this.encryptObject(data);
  }

  private encryptObject(obj: any): any {
    if (!obj || !obj.constructor) return obj;

    const fields: string[] =
      Reflect.getMetadata(ENCRYPT_FIELD_KEY, obj.constructor) || [];
    if (fields.length === 0) return obj;

    for (const field of fields) {
      if (obj[field] !== undefined && obj[field] !== null) {
        obj[field] = CryptoUtils.encryptPrimaryKey(
          String(obj[field]),
          this.config.pkSecretKey,
        );
      }
    }

    return obj;
  }
}
