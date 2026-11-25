import { isRefusal } from "../refusal.js"
import architecture from "./library/architecture.json" with { type: "json" }
import column from "./library/column.json" with { type: "json" }
import cycle from "./library/cycle.json" with { type: "json" }
import process from "./library/process.json" with { type: "json" }
import { type ComponentSpec, readComponentSpec } from "./spec.js"

function libraryComponent(name: string, raw: unknown): ComponentSpec {
  const spec = readComponentSpec(raw)
  if (isRefusal(spec)) throw new Error(`Invalid ${name} component ${JSON.stringify(spec)}`)
  return spec
}

export const columnComponent: ComponentSpec = libraryComponent("column", column)
export const processComponent: ComponentSpec = libraryComponent("process", process)
export const architectureComponent: ComponentSpec = libraryComponent("architecture", architecture)
export const cycleComponent: ComponentSpec = libraryComponent("cycle", cycle)
