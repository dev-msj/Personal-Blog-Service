import {
  BadRequestException,
  Inject,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import authConfig from '../config/authConfig';
import { CryptoUtils } from '../utils/crypto.utils';

@Injectable()
export class DecryptPrimaryKeyPipe implements PipeTransform<string, string> {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
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
    } catch (error) {
      this.logger.warn(
        `Failed to decrypt primary key parameter. - [${JSON.stringify({
          value,
          error: error instanceof Error ? error.message : String(error),
        })}]`,
      );

      throw new BadRequestException('Invalid encrypted parameter');
    }
  }
}
