import type { Kind } from "@airdesign/document"

export function isGroupKind(kind: Kind): boolean {
  return kind === "group"
}

export function paintGroup(): null {
  return null
}
