import { isRefusal } from "../refusal.js"
import architecture from "./library/architecture.json" with { type: "json" }
import clusteredChart from "./library/clustered-chart.json" with { type: "json" }
import column from "./library/column.json" with { type: "json" }
import cycle from "./library/cycle.json" with { type: "json" }
import line from "./library/line.json" with { type: "json" }
import pie from "./library/pie.json" with { type: "json" }
import process from "./library/process.json" with { type: "json" }
import { type ComponentSpec, readComponentSpec } from "./spec.js"

export type ComponentDefinition = ComponentRef & { readonly spec: ComponentSpec }
type ComponentRef = { readonly id: string; readonly revision: number }

function builtIn(id: string, raw: unknown): ComponentDefinition {
  const spec = readComponentSpec(raw)
  if (isRefusal(spec)) throw new Error(`Invalid ${id} component ${JSON.stringify(spec)}`)
  return { id, revision: 1, spec }
}

const columnTemplate = builtIn("column", column)
export const columnDefinition: ComponentDefinition = {
  ...columnTemplate,
  spec: { ...columnTemplate.spec, workLimit: 110_000 },
}
export const columnComponent: ComponentSpec = columnDefinition.spec
export const componentLibrary: ReadonlyMap<string, ComponentDefinition> = new Map(
  [columnDefinition].map((definition) => [definition.id, definition]),
)

export function componentSpec(id: string): ComponentSpec | undefined {
  return components.get(id)
}

export function resolveComponent({ id, revision }: ComponentRef): ComponentDefinition | undefined {
  const found = componentLibrary.get(id)
  return found?.revision === revision ? found : undefined
}

export const processComponent: ComponentSpec = builtIn("process", process).spec
export const architectureComponent: ComponentSpec = builtIn("architecture", architecture).spec
export const cycleComponent: ComponentSpec = builtIn("cycle", cycle).spec

export const lineComponent: ComponentSpec = { ...builtIn("line", line).spec, workLimit: 400_000 }
export const pieComponent: ComponentSpec = { ...builtIn("pie", pie).spec, workLimit: 400_000 }
export const donutComponent: ComponentSpec = {
  ...builtIn("donut", {
    ...pie,
    name: "Donut chart",
    defaultVariant: { ...pie.defaultVariant, shape: "donut" },
  }).spec,
  workLimit: 400_000,
}

export const clusteredChartComponent: ComponentSpec = {
  ...builtIn("clustered-chart", clusteredChart).spec,
  workLimit: 400_000,
  partLimit: 750,
}

const components = new Map<string, ComponentSpec>([
  [columnDefinition.id, columnComponent],
  ["process", processComponent],
  ["architecture", architectureComponent],
  ["cycle", cycleComponent],
  ["clustered-chart", clusteredChartComponent],
  ["line", lineComponent],
  ["pie", pieComponent],
  ["donut", donutComponent],
])
