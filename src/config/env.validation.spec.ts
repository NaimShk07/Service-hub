import { envValidationSchema } from "./env.validation";

describe("Environment Validation Schema", () => {
  const validBaseEnv = {
    NODE_ENV: "development",
    PORT: 8000,
    DATABASE_URL:
      "postgresql://postgres:postgrespassword@localhost:5432/servicehub?schema=public",
    REDIS_HOST: "localhost",
    REDIS_PORT: 6379,
    JWT_SECRET: "my-super-secret-access-token-key",
    JWT_REFRESH_SECRET: "my-super-secret-refresh-token-key",
  };

  it("should validate successfully with required and default values", () => {
    const { error, value } = envValidationSchema.validate(validBaseEnv, {
      abortEarly: false,
    });

    expect(error).toBeUndefined();
    expect(value.PORT).toBe(8000);
    expect(value.NODE_ENV).toBe("development");
    expect(value.JWT_EXPIRES_IN).toBe("15m");
    expect(value.JWT_REFRESH_EXPIRES_IN).toBe("7d");
    expect(value.LOG_FORMAT).toBe("json");
    expect(value.SWAGGER_ENABLED).toBe(false);
  });

  it("should fail clearly when DATABASE_URL is missing", () => {
    const env = { ...validBaseEnv };
    delete (env as any).DATABASE_URL;

    const { error } = envValidationSchema.validate(env, { abortEarly: false });
    expect(error).toBeDefined();
    expect(error?.message).toContain("DATABASE_URL is a required environment variable");
  });

  it("should fail clearly when DATABASE_URL is not a PostgreSQL URI", () => {
    const env = {
      ...validBaseEnv,
      DATABASE_URL: "mysql://user:pass@localhost:3306/db",
    };

    const { error } = envValidationSchema.validate(env, { abortEarly: false });
    expect(error).toBeDefined();
    expect(error?.message).toContain(
      "DATABASE_URL must be a valid PostgreSQL connection URI",
    );
  });

  it("should fail clearly when JWT_SECRET is missing", () => {
    const env = { ...validBaseEnv };
    delete (env as any).JWT_SECRET;

    const { error } = envValidationSchema.validate(env, { abortEarly: false });
    expect(error).toBeDefined();
    expect(error?.message).toContain("JWT_SECRET is required to secure authentication tokens");
  });

  it("should fail clearly when JWT_SECRET is too short (< 8 characters)", () => {
    const env = { ...validBaseEnv, JWT_SECRET: "short" };

    const { error } = envValidationSchema.validate(env, { abortEarly: false });
    expect(error).toBeDefined();
    expect(error?.message).toContain("JWT_SECRET must be at least 8 characters long");
  });

  it("should fail clearly when JWT_REFRESH_SECRET is missing", () => {
    const env = { ...validBaseEnv };
    delete (env as any).JWT_REFRESH_SECRET;

    const { error } = envValidationSchema.validate(env, { abortEarly: false });
    expect(error).toBeDefined();
    expect(error?.message).toContain("JWT_REFRESH_SECRET is required to secure refresh tokens");
  });

  it("should fail clearly when PORT is out of valid range", () => {
    const env = { ...validBaseEnv, PORT: 999999 };

    const { error } = envValidationSchema.validate(env, { abortEarly: false });
    expect(error).toBeDefined();
    expect(error?.message).toContain("PORT");
  });

  it("should fail clearly when NODE_ENV is invalid", () => {
    const env = { ...validBaseEnv, NODE_ENV: "invalid_env" };

    const { error } = envValidationSchema.validate(env, { abortEarly: false });
    expect(error).toBeDefined();
    expect(error?.message).toContain("NODE_ENV");
  });

  it("should report all missing variables simultaneously when abortEarly is false", () => {
    const emptyEnv = {};

    const { error } = envValidationSchema.validate(emptyEnv, { abortEarly: false });
    expect(error).toBeDefined();
    expect(error?.details.length).toBeGreaterThanOrEqual(3);
    const missingKeys = error?.details.map((d) => d.context?.key);
    expect(missingKeys).toContain("DATABASE_URL");
    expect(missingKeys).toContain("JWT_SECRET");
    expect(missingKeys).toContain("JWT_REFRESH_SECRET");
  });
});

