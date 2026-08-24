import { createHash } from "crypto";

export function buildNormalizedQueryKey(
  prefix: string,
  query: Record<string, any>,
): string {
  const cleanedQuery: Record<string, string> = {};

  for (const key of Object.keys(query)) {
    const value = query[key];

    // Ignore undefined, null, and empty string values
    if (value === undefined || value === null || value === "") {
      continue;
    }

    // Convert value to string and lowercase it
    cleanedQuery[key] = String(value).toLowerCase();
  }

  // Sort keys alphabetically to ensure deterministic ordering
  const sortedKeys = Object.keys(cleanedQuery).sort();

  // Build deterministic query string
  const params = new URLSearchParams();

  for (const key of sortedKeys) {
    params.append(key, cleanedQuery[key]);
  }

  const queryString = params.toString();

  // Generate SHA-256 hash and take first 16 characters
  const hash = createHash("sha256")
    .update(queryString)
    .digest("hex")
    .substring(0, 16);

  return `${prefix}:${hash}`;
}
