import { registerAs } from '@nestjs/config';

export default registerAs('config', () => ({
  pkSecretKey: process.env.PK_SECRET_KEY,
}));
