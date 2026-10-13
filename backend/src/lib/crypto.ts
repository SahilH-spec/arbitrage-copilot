import crypto from "crypto";
import { config, validEncryptionKey } from "../config";

// AES-256-GCM envelope for secrets stored in the database (e.g. the Plaid access token).
// Format: enc:v1:<iv>:<auth tag>:<ciphertext>, each part base64.
const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const raw = config.security.encryptionKey;
  if (!raw || !validEncryptionKey(raw)) {
    throw new Error("ENCRYPTION_KEY is missing or invalid (need 32 bytes: 64 hex chars or base64)");
  }
  return /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv, tag, ct].map((b) => b.toString("base64")).join(":");
}

export function decryptSecret(value: string): string {
  const [iv, tag, ct] = value.slice(PREFIX.length).split(":").map((p) => Buffer.from(p, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
