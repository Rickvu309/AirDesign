import { isRefusal } from "../refusal.js"
import architecture from "./library/architecture.json" with { type: "json" }
import column from "./library/column.json" with { type: "json" }
import cycle from "./library/cycle.json" with { type: "json" }
import process from "./library/process.json" with { type: "json" }
import { type ComponentSpec, readComponentSpec } from "./spec.js"

export type ComponentDefinition = ComponentRef & { readonly spec: ComponentSpec }
type ComponentRef = { readonly id: string; readonly revision: number }

function builtIn(id: string, raw: unknown): ComponentDefinition {
  const spec = readComponentSpec(raw)
  if (isRefusal(spec)) throw new Error(`Invalid ${id} component ${JSON.stringify(spec)}`)
  return { id, revision: 1, spec }
}

export const columnDefinition: ComponentDefinition = builtIn("column", column)
export const columnComponent: ComponentSpec = columnDefinition.spec
export const componentLibrary: ReadonlyMap<string, ComponentDefinition> = new Map(
  [columnDefinition].map((definition) => [definition.id, definition]),
)

export const componentSpec = (id: string) => components.get(id)

export function resolveComponent({ id, revision }: ComponentRef): ComponentDefinition | undefined {
  const found = componentLibrary.get(id)
  return found?.revision === revision ? found : undefined
}

export const processComponent: ComponentSpec = builtIn("process", process).spec
export const architectureComponent: ComponentSpec = builtIn("architecture", architecture).spec
export const cycleComponent: ComponentSpec = builtIn("cycle", cycle).spec

const components = new Map<string, ComponentSpec>([
  [columnDefinition.id, columnComponent],
  ["process", processComponent],
  ["architecture", architectureComponent],
  ["cycle", cycleComponent],
])
