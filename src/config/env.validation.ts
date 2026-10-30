import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "production", "test", "staging")
    .default("development"),
  PORT: Joi.number().port().default(8000),

  // Database
  DATABASE_URL: Joi.string()
    .uri({ scheme: ["postgres", "postgresql"] })
    .required()
    .messages({
      "any.required": "DATABASE_URL is a required environment variable.",
      "string.empty": "DATABASE_URL cannot be empty.",
      "string.uriCustomScheme":
        "DATABASE_URL must be a valid PostgreSQL connection URI (e.g. postgresql://user:pass@host:5432/db).",
    }),

  // Redis
  REDIS_HOST: Joi.string().default("localhost"),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow("").optional().default(""),

  // JWT
  JWT_SECRET: Joi.string().min(8).required().messages({
    "any.required": "JWT_SECRET is required to secure authentication tokens.",
    "string.empty": "JWT_SECRET cannot be empty.",
    "string.min": "JWT_SECRET must be at least 8 characters long for security.",
  }),
  JWT_EXPIRES_IN: Joi.string().default("15m"),
  JWT_REFRESH_SECRET: Joi.string().min(8).required().messages({
    "any.required": "JWT_REFRESH_SECRET is required to secure refresh tokens.",
    "string.empty": "JWT_REFRESH_SECRET cannot be empty.",
    "string.min": "JWT_REFRESH_SECRET must be at least 8 characters long for security.",
  }),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default("7d"),

  // Razorpay (Optional in local development/test)
  RAZORPAY_KEY_ID: Joi.string().allow("").optional().default(""),
  RAZORPAY_SECRET: Joi.string().allow("").optional().default(""),
  RAZORPAY_KEY_SECRET: Joi.string().allow("").optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().allow("").optional().default(""),

  // CORS
  CORS_ORIGINS: Joi.string().allow("").optional(),
  CORS_CREDENTIALS: Joi.boolean().default(true),

  // App & Observability
  LOG_FORMAT: Joi.string().valid("json", "text").default("json"),
  SWAGGER_ENABLED: Joi.boolean().default(false),
});

