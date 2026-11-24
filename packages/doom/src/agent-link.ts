import { field } from "./agent-fields.js"
import { readLink, withScheme } from "./link.js"
import { limits } from "./limits.js"
import { type Reader, literal, oneOf, words } from "./read-kit.js"

const readLayerLink: Reader<string> = (raw) => readLink(withScheme(words(limits.address, 1)(raw)))

export const linkField = field(
  { description: "https, mailto, a slide id, or none.", anyOf: [{ type: "string" }, { const: "none" }] },
  oneOf<string | "none">(literal(["none"] as const), readLayerLink),
)
