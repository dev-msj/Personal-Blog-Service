import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginationDto } from '../blog/dto/pagination.dto';

export const ApiOkResponsePaginationDto = <DataDto extends Type<unknown>>(
  description: string,
  dataDto: DataDto,
) =>
  applyDecorators(
    ApiExtraModels(PaginationDto, dataDto),
    ApiOkResponse({
      description: description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginationDto) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(dataDto) },
              },
            },
          },
        ],
      },
    }),
  );
