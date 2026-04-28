import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { IsInt, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PathParamAwareValidationPipe } from './path-param-aware-validation.pipe';

class SampleStringDto {
  @IsString()
  readonly title: string;
}

class SampleNumericDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page: number;
}

describe('PathParamAwareValidationPipe', () => {
  const pipe = new PathParamAwareValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  describe('path 파라미터 (metadata.type === "param")', () => {
    it('암호화된 base64 문자열을 Number 변환 없이 그대로 반환한다', async () => {
      // Given: ValidationPipe 기본 동작이라면 Number(value) → NaN이 발생하는 시나리오
      const encrypted = 'U2FsdGVkX1+abc/def==';
      const metadata: ArgumentMetadata = {
        type: 'param',
        metatype: Number,
        data: 'postId',
      };

      // When
      const result = await pipe.transform(encrypted, metadata);

      // Then: 원본 문자열 그대로
      expect(result).toBe(encrypted);
      expect(Number.isNaN(result)).toBe(false);
    });

    it('metatype이 String인 path param도 그대로 반환한다', async () => {
      const value = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const metadata: ArgumentMetadata = {
        type: 'param',
        metatype: String,
        data: 'postUid',
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toBe(value);
    });

    it('metatype이 없는 path param도 그대로 반환한다', async () => {
      const value = 'arbitrary-value';
      const metadata: ArgumentMetadata = { type: 'param', data: 'id' };

      const result = await pipe.transform(value, metadata);

      expect(result).toBe(value);
    });
  });

  describe('body / query는 super.transform에 위임된다', () => {
    it('body DTO는 class-validator 검증과 transform이 수행된다', async () => {
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SampleStringDto,
        data: '',
      };

      const result = await pipe.transform({ title: 'hello' }, metadata);

      expect(result).toBeInstanceOf(SampleStringDto);
      expect(result.title).toBe('hello');
    });

    it('body DTO 검증 실패 시 BadRequestException을 던진다', async () => {
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SampleNumericDto,
        data: '',
      };

      await expect(pipe.transform({ page: 0 }, metadata)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('query DTO는 @Type 변환이 적용된다', async () => {
      const metadata: ArgumentMetadata = {
        type: 'query',
        metatype: SampleNumericDto,
        data: '',
      };

      const result = await pipe.transform({ page: '3' }, metadata);

      expect(result).toBeInstanceOf(SampleNumericDto);
      expect(result.page).toBe(3);
    });
  });
});
