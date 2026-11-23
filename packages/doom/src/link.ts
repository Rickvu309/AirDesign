import { readNodeId } from "./ids.js"
import { limits } from "./limits.js"
import { type Reader, reject, words } from "./read-kit.js"

const address = /^(https?:\/\/[^\s/?#]+[^\s]*|mailto:[^\s]+)$/i

export const readLink: Reader<string> = (raw) => {
  const link = words(limits.address, 1)(raw)
  return address.test(link) || readNodeId(link) !== undefined ? link : reject()
}
