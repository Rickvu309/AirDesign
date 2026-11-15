import type { ElementId } from "./element-id.js"
import { siteLimit } from "./preset-sites.js"
import { trait, type NoInputs } from "./trait-decl.js"
import { count, custom, mark, record, union } from "./value-kind.js"

const end = union({
  none: mark,
  shape: record({ node: custom<ElementId, string>("node"), site: count(0, siteLimit - 1) }),
})

const noInputs: NoInputs = {}

export const connection = trait("own", { version: 1, shape: "4ad8435a" }, { start: end, end }, noInputs)
