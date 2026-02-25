import 'reflect-metadata';

export const ENCRYPT_FIELD_KEY = Symbol('ENCRYPT_FIELD');

export function EncryptField(): PropertyDecorator {
  return (target, propertyKey) => {
    const fields: string[] =
      Reflect.getMetadata(ENCRYPT_FIELD_KEY, target.constructor) || [];
    Reflect.defineMetadata(
      ENCRYPT_FIELD_KEY,
      [...fields, propertyKey],
      target.constructor,
    );
  };
}
