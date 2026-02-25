import {
  BadRequestException,
  Inject,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import authConfig from '../config/authConfig';
import { CryptoUtils } from '../utils/crypto.utils';

@Injectable()
export class DecryptPrimaryKeyPipe implements PipeTransform<string, string> {
  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  transform(value: string): string {
    try {
      const decrypted = CryptoUtils.decryptPrimaryKey(
        value,
        this.config.pkSecretKey,
      );
      if (!decrypted) {
        throw new Error('Decryption produced empty result');
      }
      return decrypted;
    } catch {
      throw new BadRequestException('Invalid encrypted parameter');
    }
  }
}
