import type { LinkEdit } from "./link-target.js"
import { trait } from "./trait-decl.js"
import { custom } from "./value-kind.js"

export const link = trait("own", { version: 1, shape: "58c5d32c" }, { target: custom<LinkEdit, LinkEdit>("link") })
