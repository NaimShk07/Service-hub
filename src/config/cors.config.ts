import { registerAs } from "@nestjs/config";

export default registerAs("cors", () => {
  const origins = process.env.CORS_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    origins: origins ?? [],
    credentials: process.env.CORS_CREDENTIALS === "true",
  };
});
