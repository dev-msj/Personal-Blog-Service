import * as Joi from 'joi';

export const validationEnv = Joi.object({
  PK_SECRET_KEY: Joi.string().required().length(16),
  JWT_SECRET_KEY: Joi.string().required(),
  JWT_ISSUER: Joi.string().required(),
  // expires 관련 값을 '1h', '7d' 같은 StringValue나 number 타입만 허용
  JWT_ACCESSTOKEN_EXPIRE_TIME: Joi.alternatives()
    .try(
      Joi.string().pattern(/^\d+[smhd]$|^\d+$/),
      Joi.number().integer().positive(),
    )
    .required(),

  JWT_REFRESHTOKEN_EXPIRE_TIME: Joi.alternatives()
    .try(
      Joi.string().pattern(/^\d+[smhd]$|^\d+$/),
      Joi.number().integer().positive(),
    )
    .required(),
  JWT_REFRESHTOKEN_REISSUE_TIME: Joi.alternatives()
    .try(
      Joi.string().pattern(/^\d+[smhd]$|^\d+$/),
      Joi.number().integer().positive(),
    )
    .required(),
  GOOGLE_CLIENT_ID: Joi.string().required(),
});
