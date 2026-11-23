import { createHash } from "node:crypto"

export const airaName = "Aira"

export function agentKey(kind: "grant" | "aira", id: string): string {
  return createHash("sha256").update(`${kind}:${id}`).digest("hex").slice(0, 16)
}
