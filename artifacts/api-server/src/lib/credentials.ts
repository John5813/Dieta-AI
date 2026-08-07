import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const LOGIN_PREFIX = "DAI";
const LOGIN_BODY_LEN = 6;
const PASSWORD_LEN = 8;
const SALT_LEN = 16;
const KEY_LEN = 32;

// Avoid easily-confused chars (0/O, 1/I/L)
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomFromAlphabet(len: number): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function generateLogin(): string {
  return `${LOGIN_PREFIX}-${randomFromAlphabet(LOGIN_BODY_LEN)}`;
}

export function generatePassword(): string {
  return randomFromAlphabet(PASSWORD_LEN);
}

export function hashPassword(plain: string): { hash: string; salt: string } {
  const salt = randomBytes(SALT_LEN).toString("hex");
  const derived = scryptSync(plain, salt, KEY_LEN);
  return { hash: derived.toString("hex"), salt };
}

export function verifyPassword(plain: string, hash: string, salt: string): boolean {
  try {
    const derived = scryptSync(plain, salt, KEY_LEN);
    const expected = Buffer.from(hash, "hex");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function normalizeLogin(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

export function normalizePassword(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}
