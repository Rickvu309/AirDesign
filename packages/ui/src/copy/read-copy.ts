import { copyKit } from "./copy-kit.ts"
import { studioFoundationCopy } from "./studio-foundation-copy.ts"

const messages = { ...studioFoundationCopy, ...copyKit }

export type CopyKey = keyof typeof messages

export function copy(key: CopyKey): string {
  return messages[key]
}

export function fillCopy(key: CopyKey, slots: Readonly<Record<string, string>>): string {
  return Object.entries(slots).reduce((text, [slot, value]) => text.replaceAll(`{${slot}}`, value), copy(key))
}
