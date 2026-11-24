import { isRefusal } from "../refusal.js"
import column from "./library/column.json" with { type: "json" }
import { type ComponentSpec, readComponentSpec } from "./spec.js"

const spec = readComponentSpec(column)
if (isRefusal(spec)) throw new Error(`Invalid column component ${JSON.stringify(spec)}`)

export const columnComponent: ComponentSpec = spec
