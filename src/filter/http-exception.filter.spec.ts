import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { ErrorCode } from '../constant/error-code.enum';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
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

    filter = new HttpExceptionFilter(mockLogger as any);
  });

  it('BadRequestException을 처리하여 COMMON_BAD_REQUEST(90001) 코드를 응답한다', () => {
    // Given
    const exception = new BadRequestException('Invalid input');

    // When
    filter.catch(exception, mockArgumentsHost);

    // Then
    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.OK);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCode.COMMON_BAD_REQUEST,
        message: 'Invalid input',
      }),
    );
  });

  it('NotFoundException을 처리하여 COMMON_NOT_FOUND(90003) 코드를 응답한다', () => {
    // Given
    const exception = new NotFoundException('Resource not found');

    // When
    filter.catch(exception, mockArgumentsHost);

    // Then
    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.OK);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCode.COMMON_NOT_FOUND,
        message: 'Resource not found',
      }),
    );
  });

  it('ValidationPipe의 배열 메시지를 결합하여 응답한다', () => {
    // Given
    const exception = new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      message: ['field must be a string', 'field must not be empty'],
      error: 'Bad Request',
    });

    // When
    filter.catch(exception, mockArgumentsHost);

    // Then
    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.OK);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCode.COMMON_BAD_REQUEST,
        message: 'field must be a string, field must not be empty',
      }),
    );
  });

  it('배열 메시지 예외 정보를 로그에 기록한다', () => {
    // Given
    const exception = new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      message: ['field must be a string', 'field must not be empty'],
      error: 'Bad Request',
    });

    // When
    filter.catch(exception, mockArgumentsHost);

    // Then
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    const loggedData = JSON.parse(mockLogger.error.mock.calls[0][0]);
    expect(loggedData.url).toBe('/test');
    expect(loggedData.response.message).toEqual([
      'field must be a string',
      'field must not be empty',
    ]);
  });

  it('예외 정보를 로그에 기록한다', () => {
    // Given
    const exception = new BadRequestException('Bad request');

    // When
    filter.catch(exception, mockArgumentsHost);

    // Then
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    const loggedData = JSON.parse(mockLogger.error.mock.calls[0][0]);
    expect(loggedData.url).toBe('/test');
    expect(loggedData.response.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(loggedData.response.message).toBe('Bad request');
  });
});
