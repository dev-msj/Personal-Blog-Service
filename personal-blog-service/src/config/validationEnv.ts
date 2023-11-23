import * as Joi from 'joi';

export const validationEnv = Joi.object({
  PK_SECRET_KEY: Joi.string().required(),
});
