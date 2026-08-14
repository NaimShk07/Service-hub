import appConfig from "./app.config";
import databaseConfig from "./database.config";
import jwtConfig from "./jwt.config";
import redisConfig from "./redis.config";
import razorpayConfig from "./razorpay.config";
import corsConfig from "./cors.config";

export const configs = [
  appConfig,
  databaseConfig,
  jwtConfig,
  redisConfig,
  razorpayConfig,
  corsConfig,
];

export {
  appConfig,
  databaseConfig,
  jwtConfig,
  redisConfig,
  razorpayConfig,
  corsConfig,
};
