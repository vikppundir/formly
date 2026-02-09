/**
 * Password hashing (bcrypt) and token hashing for refresh token storage.
 * Never store plaintext passwords or raw refresh tokens.
 */

import bcrypt from "bcrypt";
import { createHash } from "crypto";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

/** Hash refresh token for storage (revocation check). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
