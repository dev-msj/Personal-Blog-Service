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
  COOKIE_MAX_AGE: Joi.alternatives()
    .try(
      Joi.string().pattern(/^\d+[smhdwy]$|^\d+$/), // s, m(분), h, d, w, y
      Joi.number().integer().positive(),
    )
    .optional(),
  COOKIE_SAME_SITE: Joi.string().valid('strict', 'lax', 'none').optional(),
  GOOGLE_CLIENT_ID: Joi.string().required(),
  REDIS_PASSWORD: Joi.string().required(),
});
