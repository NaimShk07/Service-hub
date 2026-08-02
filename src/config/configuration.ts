import appConfig from './app.config';
import databaseConfig from './database.config';
import jwtConfig from './jwt.config';
import redisConfig from './redis.config';
import razorpayConfig from './razorpay.config';

export const configs = [
  appConfig,
  databaseConfig,
  jwtConfig,
  redisConfig,
  razorpayConfig,
];

export { appConfig, databaseConfig, jwtConfig, redisConfig, razorpayConfig };
