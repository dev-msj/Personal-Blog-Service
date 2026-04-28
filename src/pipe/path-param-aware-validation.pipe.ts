import { ArgumentMetadata, Injectable, ValidationPipe } from '@nestjs/common';

/**
 * 전역 ValidationPipe 확장. NestJS 파이프 실행 순서상 global pipe가 param-level
 * 사용자 파이프(예: DecryptPrimaryKeyPipe, ParseIntPipe)보다 먼저 실행되며,
 * `transform: true`의 transformPrimitive가 컨트롤러 시그니처의 `: number`로부터
 * metatype=Number를 추론해 path 파라미터에 `Number(value)`를 적용한다.
 * 이 동작은 암호화된 path 파라미터(예: AES base64)를 NaN으로 변환해
 * 후속 사용자 파이프의 복호화를 차단한다.
 *
 * 본 클래스는 `metadata.type === 'param'`일 때 ValidationPipe 처리를 우회하여
 * 사용자 파이프 체인이 원문을 그대로 받도록 보장한다. body/query/custom은
 * 기존 동작을 유지한다.
 */
@Injectable()
export class PathParamAwareValidationPipe extends ValidationPipe {
  override async transform(
    value: any,
    metadata: ArgumentMetadata,
  ): Promise<any> {
    if (metadata.type === 'param') {
      return value;
    }
    return super.transform(value, metadata);
  }
}
