import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

export function newSecret(): string {
  return randomBytes(32).toString("base64url")
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex")
}

export function challengeOf(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url")
}

export function sameSecret(left: string, right: string): boolean {
  return timingSafeEqual(Buffer.from(hashSecret(left), "hex"), Buffer.from(hashSecret(right), "hex"))
}
