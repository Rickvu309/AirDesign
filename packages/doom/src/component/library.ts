import { isRefusal } from "../refusal.js"
import architecture from "./library/architecture.json" with { type: "json" }
import clusteredChart from "./library/clustered-chart.json" with { type: "json" }
import column from "./library/column.json" with { type: "json" }
import cycle from "./library/cycle.json" with { type: "json" }
import line from "./library/line.json" with { type: "json" }
import pie from "./library/pie.json" with { type: "json" }
import matrix from "./library/matrix.json" with { type: "json" }
import process from "./library/process.json" with { type: "json" }
import tree from "./library/tree.json" with { type: "json" }
import stacked from "./library/stacked.json" with { type: "json" }
import waterfall from "./library/waterfall.json" with { type: "json" }
import { type ComponentSpec, readComponentSpec } from "./spec.js"

export type ComponentDefinition = ComponentRef & {
  readonly spec: ComponentSpec
  readonly sizeTokens: readonly string[]
}
type ComponentRef = { readonly id: string; readonly revision: number }

function builtIn(id: string, raw: unknown, sizeTokens: readonly string[] = []): ComponentDefinition {
  const spec = readComponentSpec(raw)
  if (isRefusal(spec)) throw new Error(`Invalid ${id} component ${JSON.stringify(spec)}`)
  return { id, revision: 1, spec, sizeTokens }
}

const columnTemplate = builtIn("column", column, ["captionSmall"])
export const columnDefinition: ComponentDefinition = {
  ...columnTemplate,
  spec: { ...columnTemplate.spec, workLimit: 110_000 },
}
const architectureDefinition = builtIn("architecture", architecture, ["layerSmall", "labelSmall"])
const cycleDefinition = builtIn("cycle", cycle, ["labelSmall"])
const matrixDefinition = builtIn("matrix", matrix)
const processDefinition = builtIn("process", process, ["labelSmall", "rowLabelSmall"])
const treeDefinition = builtIn("tree", tree)
export const columnComponent: ComponentSpec = columnDefinition.spec
export const processComponent: ComponentSpec = processDefinition.spec
export const architectureComponent: ComponentSpec = architectureDefinition.spec
export const cycleComponent: ComponentSpec = cycleDefinition.spec
export const matrixComponent: ComponentSpec = matrixDefinition.spec
export const treeComponent: ComponentSpec = treeDefinition.spec

export const componentLibrary: ReadonlyMap<string, ComponentDefinition> = new Map(
  [columnDefinition, architectureDefinition, cycleDefinition, matrixDefinition, processDefinition, treeDefinition].map(
    (definition) => [definition.id, definition],
  ),
)

export function componentSpec(id: string): ComponentSpec | undefined {
  return componentLibrary.get(id)?.spec ?? expandedComponents.get(id)
}

export function resolveComponent({ id, revision }: ComponentRef): ComponentDefinition | undefined {
  const found = componentLibrary.get(id)
  return found?.revision === revision ? found : undefined
}

export const clusteredChartComponent: ComponentSpec = {
  ...builtIn("clustered-chart", clusteredChart).spec,
  workLimit: 400_000,
  partLimit: 750,
}
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
export const stackedComponent: ComponentSpec = builtIn("stacked", stacked).spec
export const waterfallComponent: ComponentSpec = builtIn("waterfall", waterfall).spec

const expandedComponents = new Map<string, ComponentSpec>([
  ["clustered-chart", clusteredChartComponent],
  ["line", lineComponent],
  ["pie", pieComponent],
  ["donut", donutComponent],
  ["stacked", stackedComponent],
  ["waterfall", waterfallComponent],
])
