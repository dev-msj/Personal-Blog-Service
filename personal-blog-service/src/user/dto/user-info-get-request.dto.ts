import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UserInfoGetRequestDto {
  @ApiProperty({
    description: 'Server에서 암호화하여 보내준 uid 값',
    example: 'U2FsdGVkX18LAR9DqL2ix0kCNjn9zvceXoSyrKHkl4QRf8hgyRIWObotjECRakTV',
  })
  @IsString()
  @IsNotEmpty()
  readonly uid: string;

  constructor(uid: string) {
    this.uid = uid;
  }
}
