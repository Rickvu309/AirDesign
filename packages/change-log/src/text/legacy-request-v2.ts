import {createHash} from "node:crypto"
import type {ExecutionIdentity} from "../index.ts"

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,field]) => `${JSON.stringify(key)}:${canonical(field)}`).join(",")}}`
  return JSON.stringify(value) ?? "null"
}
export function legacyRequestPayloadV2(command: unknown, identity: ExecutionIdentity, preparation?: string): string {
  return createHash("sha256").update(canonical({command, identity, ...(preparation === undefined ? {} : {preparation})})).digest("hex")
}

export function legacyThemeOnlyV2(before: unknown, after: unknown): boolean {
  const withoutThemes = (deck: unknown) => canonical(JSON.parse(JSON.stringify(deck, (key, value) => ["themes", "theme", "version"].includes(key) ? undefined : value)))
  const withThemes = (deck: unknown) => canonical(JSON.parse(JSON.stringify(deck, (key, value) => key === "version" ? undefined : value)))
  return withThemes(before) !== withThemes(after) && withoutThemes(before) === withoutThemes(after)
}
