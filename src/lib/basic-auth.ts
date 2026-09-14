import { createHash, timingSafeEqual } from "node:crypto";

// Hash first so both buffers have equal length, as timingSafeEqual requires
const safeEqual = (a: string, b: string): boolean =>
  timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );

/**
 * Check an `Authorization: Basic ...` header against expected credentials.
 * Passwords may contain ":" (only the first colon separates user and password).
 */
export const isValidBasicAuth = (
  header: string | undefined,
  username: string,
  password: string,
): boolean => {
  if (!header?.startsWith("Basic ")) return false;

  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator === -1) return false;

  const user = decoded.slice(0, separator);
  const pass = decoded.slice(separator + 1);
  // Evaluate both so timing does not reveal which part was wrong
  const userOk = safeEqual(user, username);
  const passOk = safeEqual(pass, password);
  return userOk && passOk;
};
