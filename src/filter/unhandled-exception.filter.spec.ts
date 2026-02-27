import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { UnhandledExceptionFilter } from './unhandled-exception.filter';
import { ErrorCode } from '../constant/error-code.enum';

describe('UnhandledExceptionFilter', () => {
  let filter: UnhandledExceptionFilter;
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

    filter = new UnhandledExceptionFilter(mockLogger as any);
  });

  it('일반 Error를 COMMON_INTERNAL_ERROR(90006)로 변환하여 응답한다', () => {
    // Given
    const exception = new Error('Something went wrong');

    // When
    filter.catch(exception, mockArgumentsHost);

    // Then
    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.OK);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCode.COMMON_INTERNAL_ERROR,
        message: 'Internal Server Error!',
      }),
    );
  });

  it('TypeError를 COMMON_INTERNAL_ERROR(90006)로 변환하여 응답한다', () => {
    // Given
    const exception = new TypeError('Cannot read property of undefined');

    // When
    filter.catch(exception, mockArgumentsHost);

    // Then
    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.OK);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCode.COMMON_INTERNAL_ERROR,
        message: 'Internal Server Error!',
      }),
    );
  });

  it('원본 에러 정보를 로그에 기록한다', () => {
    // Given
    const exception = new RangeError('Out of range');

    // When
    filter.catch(exception, mockArgumentsHost);

    // Then
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    const loggedData = JSON.parse(mockLogger.error.mock.calls[0][0]);
    expect(loggedData.url).toBe('/test');
    expect(loggedData.response.error).toBe('RangeError');
    expect(loggedData.response.message).toBe('Out of range');
  });
});
