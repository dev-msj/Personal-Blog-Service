import { ApiResponseOptions } from '@nestjs/swagger';

export const successResponseOptions: ApiResponseOptions = {
  description: 'Success Message',
  schema: {
    type: 'object',
    example: {
      code: 200,
      message: 'Success!',
    },
  },
};
