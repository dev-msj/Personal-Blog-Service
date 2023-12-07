import * as Joi from 'joi';

export const validationEnv = Joi.object({
  PK_SECRET_KEY: Joi.string().required().length(16),
  JWT_SECRET_KEY: Joi.string().required(),
  JWT_ISSUER: Joi.string().required(),
  JWT_ACCESSTOKEN_EXPIRE_TIME: Joi.string().required(),
  JWT_REFRESHTOKEN_EXPIRE_TIME: Joi.string().required(),
  JWT_REFRESHTOKEN_REISSUE_TIME: Joi.number().required(),
  GOOGLE_CLIENT_ID: Joi.string().required(),
});
