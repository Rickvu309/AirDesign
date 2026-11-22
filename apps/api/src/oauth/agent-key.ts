import { createHash } from "node:crypto"

export function agentKey(kind: "grant" | "aira", id: string): string {
  return createHash("sha256").update(`${kind}:${id}`).digest("hex").slice(0, 16)
}
