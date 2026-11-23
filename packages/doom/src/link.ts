import { readNodeId } from "./ids.js"
import { limits } from "./limits.js"
import { type Reader, oneOf, reject, rejected, words } from "./read-kit.js"

const address = /^(https?:\/\/[^\s/?#]+[^\s]*|mailto:[^\s?]+(?:\?[^\s]*)?)$/i

const readAddress: Reader<string> = (raw) => {
  const link = words(limits.address, 1)(raw)
  return address.test(link) ? link : reject()
}

export const readLink: Reader<string> = oneOf(readAddress, (raw) => readNodeId(raw) ?? reject())

export function readLinkAddress(raw: unknown): string | undefined {
  try {
    return readAddress(raw)
  } catch (thrown) {
    rejected(thrown)
    return undefined
  }
}
