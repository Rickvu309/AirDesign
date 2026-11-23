import { readNodeId } from "./ids.js"
import { limits } from "./limits.js"
import { type Reader, reject, rejected, words } from "./read-kit.js"

const address = /^(https?:\/\/[^\s/?#]+[^\s]*|mailto:[^\s]+)$/i

export const readLink: Reader<string> = (raw) => {
  const link = words(limits.address, 1)(raw)
  return address.test(link) || readNodeId(link) !== undefined ? link : reject()
}

export function readLinkAddress(raw: unknown): string | undefined {
  try {
    const link = words(limits.address, 1)(raw)
    return address.test(link) ? link : undefined
  } catch (thrown) {
    rejected(thrown)
    return undefined
  }
}
