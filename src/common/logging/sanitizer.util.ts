const SENSITIVE_KEYS = new Set([
  "password",
  "newpassword",
  "currentpassword",
  "confirmpassword",
  "passwordhash",
  "refreshtoken",
  "refreshtokenhash",
  "accesstoken",
  "token",
  "authorization",
  "cookie",
  "set-cookie",
  "secret",
  "webhooksecret",
  "keysecret",
  "razorpay_signature",
  "razorpaysignature",
  "signature",
  "clientsecret",
  "client_secret",
  "privatekey",
  "private_key",
  "apikey",
  "api_key",
  "cardnumber",
  "cvv",
  "cvc",
  "pan",
  "ssn",
  "aadhaar",
]);

const BEARER_REGEX = /Bearer\s+[A-Za-z0-9-_=.]+/gi;

/**
 * Recursively redacts sensitive fields like passwords, tokens, hashes, and card numbers.
 */
export function sanitizeLogData(obj: any, depth = 0): any {
  if (depth > 5 || obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    return obj.replace(BEARER_REGEX, "Bearer [REDACTED]");
  }

  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeLogData(item, depth + 1));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
    if (
      SENSITIVE_KEYS.has(key.toLowerCase()) ||
      SENSITIVE_KEYS.has(normalizedKey)
    ) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      sanitized[key] = sanitizeLogData(value, depth + 1);
    } else if (typeof value === "string") {
      sanitized[key] = value.replace(BEARER_REGEX, "Bearer [REDACTED]");
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
