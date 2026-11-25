import { readNodeId } from "./ids.js"
import { limits } from "./limits.js"
import { type Reader, Reject, accepting, oneOf, reject, words } from "./read-kit.js"

export const agentLinkTarget = "text"

const address = /^(https?:\/\/[^\s/?#]+[^\s]*|mailto:[^\s?]+(?:\?[^\s]*)?)$/i
const scheme = /^[a-z][a-z0-9+.-]*:/i

export const withScheme = (typed: string): string => (scheme.test(typed) ? typed : `https://${typed}`)

const readAddress: Reader<string> = (raw) => {
  const link = words(limits.address, 1)(raw)
  return address.test(link) ? link : reject()
}

export const readLink: Reader<string> = accepting(
  "An https or mailto address, or a slide id.",
  oneOf(readAddress, (raw) => readNodeId(raw) ?? reject()),
)

export function readLinkAddress(raw: unknown): string | undefined {
  try {
    return readAddress(raw)
  } catch (thrown) {
    if (!(thrown instanceof Reject)) throw thrown
    return undefined
  }
}
