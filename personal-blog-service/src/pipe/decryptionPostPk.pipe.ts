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
import authConfig from '../config/authConfig';
import { CryptoUtils } from '../utils/crypto.utils';
import { PostPageRequestDto } from '../blog/dto/post-page-request.dto';

@Injectable()
export class DecryptionPostPKPipe implements PipeTransform {
  @Inject(authConfig.KEY)
  private config: ConfigType<typeof authConfig>;

  async transform(
    value: object | string,
    { metatype }: ArgumentMetadata,
  ): Promise<PostPageRequestDto | number> {
    if (!metatype || !this.toValidate(metatype)) {
      throw new BadRequestException('Metatype Validation failed');
    }

    if (Object.keys(value).includes('postUid')) {
      value['postUid'] = CryptoUtils.decryptPostPK(
        value['postUid'],
        this.config.pkSecretKey,
      );
      value['page'] = Number(value['page']) || 1;

      const postPageRequestDto = plainToClass(metatype, value);
      const errors = await validate(postPageRequestDto);
      if (errors.length > 0) {
        throw new BadRequestException('Validation failed');
      }

      return postPageRequestDto;
    } else {
      return Number(
        CryptoUtils.decryptPostPK(value as string, this.config.pkSecretKey),
      );
    }
  }

  private toValidate(metatype: Type<any> | undefined): boolean {
    const types: Type<any>[] = [PostPageRequestDto, Number];

    return types.includes(metatype);
  }
}
