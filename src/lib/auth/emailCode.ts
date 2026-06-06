import { createHash, randomInt } from "crypto";

export function generateCode(): string {
  return String(randomInt(100000, 999999));
}

export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function verifyCode(code: string, hash: string): boolean {
  return hashCode(code) === hash;
}
