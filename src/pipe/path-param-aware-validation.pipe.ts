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
 *
 * TODO(Phase 2 observability / Phase 5 NestJS 11): 부모 ValidationPipe.transform
 * 내부에 cross-cutting 로직(OTel trace span, 추가 보안 검증 등)이 도입되면
 * param 분기에서 누락된다. Phase 2 OpenTelemetry 도입 시 path param trace 누락
 * 점검 필요. Phase 5 NestJS 11 업그레이드 시 부모 transform 내부 동작 변경에
 * 대한 회귀 검증을 본 클래스 책임으로 포함.
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
