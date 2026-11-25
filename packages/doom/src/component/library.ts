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
  readonly source: unknown
}
type ComponentRef = { readonly id: string; readonly node?: never; readonly revision: number }

function builtIn(id: string, raw: unknown, sizeTokens: readonly string[] = []): ComponentDefinition {
  const spec = readComponentSpec(raw)
  if (isRefusal(spec)) throw new Error(`Invalid ${id} component ${JSON.stringify(spec)}`)
  return { id, revision: 1, spec, sizeTokens, source: raw }
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

export function componentSpec(id: string): ComponentSpec | undefined {
  return id === "donut" ? donutComponent : componentLibrary.get(id)?.spec
}

export function resolveComponent({ id, revision }: ComponentRef): ComponentDefinition | undefined {
  const found = componentLibrary.get(id)
  return found?.revision === revision ? found : undefined
}

const chart = (id: string, raw: unknown, limits: Pick<ComponentSpec, "workLimit" | "partLimit"> = {}) => {
  const definition = builtIn(id, raw, ["captionSmall"])
  return { ...definition, spec: { ...definition.spec, ...limits } }
}
const clusteredDefinition = chart("clustered-chart", clusteredChart, { workLimit: 400_000, partLimit: 750 })
const lineDefinition = chart("line", line, { workLimit: 400_000 })
const pieDefinition = chart("pie", pie, { workLimit: 400_000 })
const stackedDefinition = chart("stacked", stacked, { workLimit: 200_000 })
const waterfallDefinition = chart("waterfall", waterfall)

export const clusteredChartComponent: ComponentSpec = clusteredDefinition.spec
export const lineComponent: ComponentSpec = lineDefinition.spec
export const pieComponent: ComponentSpec = pieDefinition.spec
export const donutComponent: ComponentSpec = chart(
  "donut",
  {
    ...pie,
    name: "Donut chart",
    defaultVariant: { ...pie.defaultVariant, shape: "donut" },
  },
  { workLimit: 400_000 },
).spec

export const componentLibrary: ReadonlyMap<string, ComponentDefinition> = new Map(
  [
    columnDefinition,
    architectureDefinition,
    cycleDefinition,
    matrixDefinition,
    processDefinition,
    treeDefinition,
    clusteredDefinition,
    stackedDefinition,
    waterfallDefinition,
    lineDefinition,
    pieDefinition,
  ].map((definition) => [definition.id, definition]),
)
