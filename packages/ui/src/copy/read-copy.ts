import { copyKit, type CopyKey } from "./copy-kit.ts"

export type { CopyKey }

export function copy(key: CopyKey): string {
  return copyKit[key]
}

export function fillCopy(key: CopyKey, slots: Readonly<Record<string, string>>): string {
  return Object.entries(slots).reduce((text, [slot, value]) => text.replaceAll(`{${slot}}`, value), copy(key))
}
