import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export abstract class BaseResponse {
  @ApiProperty({
    description: '상태 코드',
    examples: ['200', '500', '...'],
  })
  readonly code: number;

  @ApiProperty({
    description: '상태 메세지',
    example: ['Success', 'Interal Server Error', '...'],
  })
  readonly message: string;

  constructor(code: HttpStatus, message: string) {
    this.code = code;
    this.message = message;
  }
}
