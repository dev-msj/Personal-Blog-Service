import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constant/error-code.enum';

/**
 * HttpException HTTP status → 도메인 ErrorCode 단일 매핑 (단일 진실 원천).
 *
 * HttpExceptionFilter(예외 → FailureResponse 실시간 변환)와
 * IdempotencyKeyInterceptor(핸들러 실패 스냅샷 캐싱)가 공유한다. 멱등성상 최초
 * 실시간 응답의 code와 같은 키 재요청(R3) 재반환 code가 동일해야 하므로 두 경로의
 * 매핑이 분기하면 안 된다 — 미러 복제 대신 본 상수를 단일 소스로 참조한다.
 */
export const HTTP_STATUS_TO_ERROR_CODE: Readonly<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.COMMON_BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.COMMON_UNAUTHORIZED,
  [HttpStatus.NOT_FOUND]: ErrorCode.COMMON_NOT_FOUND,
  [HttpStatus.NOT_ACCEPTABLE]: ErrorCode.COMMON_NOT_ACCEPTABLE,
  [HttpStatus.CONFLICT]: ErrorCode.COMMON_CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.COMMON_TOO_MANY_REQUESTS,
  [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorCode.COMMON_INTERNAL_ERROR,
  [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.COMMON_SERVICE_UNAVAILABLE,
};

/**
 * HttpException.getResponse() 반환(string | object)에서 메시지 문자열을 추출한다.
 * class-validator 등이 message 배열을 줄 수 있어 배열은 ', '로 합친다.
 */
export function extractHttpExceptionMessage(response: string | object): string {
  if (typeof response === 'string') {
    return response;
  }
  const message = (response as Record<string, unknown>).message;
  if (Array.isArray(message)) {
    return message.join(', ');
  }
  return typeof message === 'string' ? message : '';
}
