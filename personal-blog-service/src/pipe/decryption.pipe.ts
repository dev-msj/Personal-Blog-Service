import {
  ArgumentMetadata,
  BadRequestException,
  Inject,
  Injectable,
  PipeTransform,
  Type,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { AES } from 'crypto-js';
import * as CryptoJS from 'crypto-js';
import authConfig from '../config/authConfig';

@Injectable()
export class DecryptionPipe implements PipeTransform<any> {
  constructor(
    @Inject(authConfig.KEY)
    private config: ConfigType<typeof authConfig>,
  ) {}

  async transform(value: any, { metatype }: ArgumentMetadata): Promise<number> {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToClass(metatype, value);
    const errors = await validate(object);
    if (errors.length > 0) {
      throw new BadRequestException('Validation failed');
    }

    return Number(
      AES.decrypt(decodeURIComponent(value), this.config.pkSecretKey).toString(
        CryptoJS.enc.Utf8,
      ),
    );
  }

  private toValidate(metatype: Type<any> | undefined): boolean {
    const types: Type<any> = String;

    return types !== metatype;
  }
}
