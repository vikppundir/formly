/**
 * Field-level encryption for sensitive data (TFN, ABN, signatures, API credentials).
 * Uses AES-256-GCM for authenticated encryption.
 * 
 * Key management: FIELD_ENCRYPTION_KEY env var (32+ chars, base64 or hex).
 * Future: integrate with AWS KMS / HashiCorp Vault for key management.
 */

import crypto from "crypto";
import { getEnv } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCODING = "hex";
// Prefix to identify encrypted values
const ENCRYPTED_PREFIX = "enc:";

/**
 * Derive a 32-byte key from the FIELD_ENCRYPTION_KEY environment variable.
 * Uses SHA-256 hash to normalize key length.
 */
function getEncryptionKey(): Buffer {
  const env = getEnv();
  const rawKey = env.FIELD_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error("FIELD_ENCRYPTION_KEY is not configured. Cannot encrypt/decrypt sensitive data.");
  }
  // Derive consistent 32-byte key from the env variable
  return crypto.createHash("sha256").update(rawKey).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a prefixed string: "enc:<iv>:<authTag>:<ciphertext>" in hex.
 */
export function encryptField(plaintext: string): string {
  if (!plaintext) return plaintext;
  // Don't double-encrypt
  if (plaintext.startsWith(ENCRYPTED_PREFIX)) return plaintext;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", ENCODING);
  encrypted += cipher.final(ENCODING);
  const authTag = cipher.getAuthTag().toString(ENCODING);

  return `${ENCRYPTED_PREFIX}${iv.toString(ENCODING)}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an encrypted field value.
 * Expects format: "enc:<iv>:<authTag>:<ciphertext>" in hex.
 * Returns plaintext string, or the original value if not encrypted.
 */
export function decryptField(encryptedValue: string): string {
  if (!encryptedValue) return encryptedValue;
  // If not encrypted, return as-is (backwards compatibility)
  if (!encryptedValue.startsWith(ENCRYPTED_PREFIX)) return encryptedValue;

  const key = getEncryptionKey();
  const data = encryptedValue.slice(ENCRYPTED_PREFIX.length);
  const [ivHex, authTagHex, ciphertext] = data.split(":");

  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error("Invalid encrypted field format");
  }

  const iv = Buffer.from(ivHex, ENCODING);
  const authTag = Buffer.from(authTagHex, ENCODING);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, ENCODING, "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Check if a value is encrypted (has the enc: prefix).
 */
export function isEncrypted(value: string): boolean {
  return !!value && value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Compute a deterministic HMAC-SHA256 hash of a value.
 * Used for uniqueness lookups on encrypted fields (e.g. tfnHash).
 * Same plaintext always produces the same hash, but the hash is irreversible.
 */
export function hmacField(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getEncryptionKey();
  return crypto.createHmac("sha256", key).update(plaintext).digest(ENCODING);
}

/**
 * Returns true if FIELD_ENCRYPTION_KEY is configured and encryption is available.
 */
export function isEncryptionAvailable(): boolean {
  try {
    const env = getEnv();
    return !!env.FIELD_ENCRYPTION_KEY && env.FIELD_ENCRYPTION_KEY.length >= 32;
  } catch {
    return false;
  }
}

/**
 * Safely encrypt a field value — returns plaintext if encryption key is not configured.
 * Use this during the transition period while FIELD_ENCRYPTION_KEY might not be set.
 */
export function safeEncryptField(plaintext: string | null | undefined): string | null | undefined {
  if (!plaintext) return plaintext;
  if (!isEncryptionAvailable()) return plaintext;
  return encryptField(plaintext);
}

/**
 * Safely decrypt a field value — returns as-is if not encrypted or key unavailable.
 */
export function safeDecryptField(value: string | null | undefined): string | null | undefined {
  if (!value) return value;
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value; // not encrypted, return as-is
  if (!isEncryptionAvailable()) return value; // can't decrypt without key
  return decryptField(value);
}

/**
 * Safely compute HMAC hash — returns null if encryption key is not configured.
 */
export function safeHmacField(plaintext: string | null | undefined): string | null | undefined {
  if (!plaintext) return null;
  if (!isEncryptionAvailable()) return null;
  return hmacField(plaintext);
}

/**
 * Mask a TFN for display (show last 3 digits only).
 */
export function maskTfn(tfn: string): string {
  if (!tfn) return tfn;
  const plain = isEncrypted(tfn) ? decryptField(tfn) : tfn;
  return "***-***-" + plain.slice(-3);
}

/**
 * Mask an ABN for display (show last 3 digits only).
 */
export function maskAbn(abn: string): string {
  if (!abn) return abn;
  const plain = isEncrypted(abn) ? decryptField(abn) : abn;
  return "*".repeat(Math.max(0, plain.length - 3)) + plain.slice(-3);
}

/**
 * Encrypt sensitive fields in an object. Specify which keys to encrypt.
 */
export function encryptFields<T extends Record<string, unknown>>(
  data: T,
  fieldNames: string[]
): T {
  const result = { ...data };
  for (const field of fieldNames) {
    const value = result[field];
    if (typeof value === "string" && value.length > 0) {
      (result as Record<string, unknown>)[field] = encryptField(value);
    }
  }
  return result;
}

/**
 * Decrypt sensitive fields in an object. Specify which keys to decrypt.
 */
export function decryptFields<T extends Record<string, unknown>>(
  data: T,
  fieldNames: string[]
): T {
  const result = { ...data };
  for (const field of fieldNames) {
    const value = result[field];
    if (typeof value === "string" && value.length > 0) {
      (result as Record<string, unknown>)[field] = decryptField(value);
    }
  }
  return result;
}
