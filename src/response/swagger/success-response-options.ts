import { ApiResponseOptions } from '@nestjs/swagger';

export const successResponseOpions: ApiResponseOptions = {
  description: 'Success Message',
  schema: {
    type: 'object',
    example: {
      code: 200,
      message: 'Success!',
    },
  },
};
