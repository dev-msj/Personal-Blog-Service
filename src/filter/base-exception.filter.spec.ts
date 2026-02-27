import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from './base-exception.filter';
import { InvalidPageException } from '../exception/invalid-page.exception';
import { UnexpectedCodeException } from '../exception/unexpected-code.exception';
import { ErrorCode } from '../constant/error-code.enum';

describe('BaseExceptionFilter', () => {
  let filter: BaseExceptionFilter;
  let mockLogger: { error: jest.Mock };
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(() => {
    mockLogger = { error: jest.fn() };
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    mockArgumentsHost = {
      switchToHttp: () => ({
        getRequest: () => ({ url: '/test' }),
        getResponse: () => ({ status: mockStatus }),
      }),
    } as unknown as ArgumentsHost;

    filter = new BaseExceptionFilter(mockLogger as any);
  });

  it('InvalidPageException의 errorCode(91002)가 응답에 반영된다', () => {
    // Given
    const exception = new InvalidPageException(-1);

    // When
    filter.catch(exception, mockArgumentsHost);

    // Then
    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.OK);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCode.INVALID_PAGE,
        message: exception.message,
      }),
    );
  });

  it('UnexpectedCodeException의 errorCode(90004)가 응답에 반영된다', () => {
    // Given
    const exception = new UnexpectedCodeException(
      ErrorCode.COMMON_NOT_ACCEPTABLE,
      'Unexpected code',
      '200',
    );

    // When
    filter.catch(exception, mockArgumentsHost);

    // Then
    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.OK);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCode.COMMON_NOT_ACCEPTABLE,
        message: 'Unexpected code',
      }),
    );
  });

  it('예외 정보를 로그에 기록한다', () => {
    // Given
    const exception = new InvalidPageException(0);

    // When
    filter.catch(exception, mockArgumentsHost);

    // Then
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    const loggedData = JSON.parse(mockLogger.error.mock.calls[0][0]);
    expect(loggedData.url).toBe('/test');
    expect(loggedData.response.errorCode).toBe(ErrorCode.INVALID_PAGE);
    expect(loggedData.response.message).toBe(exception.message);
    expect(loggedData.response.value).toBe('0');
  });
});
