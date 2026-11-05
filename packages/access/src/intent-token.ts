import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { accessPolicy } from "./access-policy.ts"
import { isIntentKind, type IntentKind } from "./intent-kinds.ts"

export type SignedIntent = {
  kind: IntentKind
  exp: number
  token: string
}

export function issueIntent(secret: string, kind: IntentKind, now: number): SignedIntent {
  const exp = now + accessPolicy.intentTtlMs
  const payload = Buffer.from(JSON.stringify({ kind, exp, nonce: randomBytes(16).toString("hex") })).toString("base64url")
  return { kind, exp, token: `${payload}.${mac(secret, payload)}` }
}

export function readIntent(secret: string, token: string): SignedIntent | null {
  const parts = token.split(".")
  if (parts.length !== 2) {
    return null
  }
  const payload = parts[0]
  const presented = parts[1]
  if (!payload || !presented) {
    return null
  }
  const expected = mac(secret, payload)
  const left = Buffer.from(presented)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object") {
    return null
  }
  const record = parsed as { kind?: unknown; exp?: unknown }
  if (typeof record.kind !== "string" || !isIntentKind(record.kind) || typeof record.exp !== "number") {
    return null
  }
  return { kind: record.kind, exp: record.exp, token }
}

export function usableIntent(secret: string, token: string, now: number): SignedIntent | null {
  const intent = readIntent(secret, token)
  if (!intent || intent.exp <= now) {
    return null
  }
  return intent
}

function mac(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url")
}
