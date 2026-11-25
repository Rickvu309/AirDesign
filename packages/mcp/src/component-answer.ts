import * as doom from "@airdesign/doom"

const estimate = doom.measureWith({})
const shownFindings = 10

function findingMessage(finding: doom.ComponentFinding, categoryCount: number): string {
  switch (finding.kind) {
    case "advice":
      return finding.note
    case "check":
    case "notice":
      return finding.message
    case "flow-omitted":
      return finding.omitted.length === 1
        ? "omitted 1 item that did not fit."
        : `omitted ${finding.omitted.length} items that did not fit.`
    case "rounded-to-zero":
      return `rounds ${finding.value} to zero at the current precision.`
    case "focus-missing":
      return `could not focus ${finding.unknown.join(", ")}. ${finding.available.length ? `Use one of ${finding.available.join(", ")}.` : "Clear focus with []."}`
    case "many-series":
      return `needs ${finding.count} distinct colours. Use at most ${finding.capacity} colour groups or split the chart.`
    case "text-fit": {
      const { neededWidth, availableWidth, thinned } = finding
      const guidance =
        finding.key[0] === "categories" && categoryCount > 12
          ? " Show fewer categories, or use a line chart for a trend or a bar chart for a ranking."
          : ""
      return `needs ${Math.ceil(neededWidth)} px in ${Math.floor(availableWidth)} px${thinned === undefined ? "." : `, with ${thinned} labels thinned.`}${guidance}`
    }
  }
}

export function componentFindings(fold: doom.Doom, ids: readonly doom.NodeId[], measure = estimate) {
  const findings: { node: doom.NodeId; code: string; key: doom.PartKey; note: string }[] = []
  for (const node of new Set(ids)) {
    const tree = doom.componentTree(fold, node, measure)
    if (doom.isRefusal(tree)) continue
    const instance = doom.propOf(fold.nodes.get(node), "instance")
    const categoryCount = instance?.component.id === "column" ? (instance.data.rows?.length ?? 0) : 0
    for (const finding of tree.findings) {
      const { kind, key } = finding
      const subject = `${node} ${key.join(" / ")}`
      const note = `${subject} ${findingMessage(finding, categoryCount)}`
      findings.push({ node, code: finding.kind === "advice" ? finding.code : kind, key, note })
      if (findings.length === shownFindings) return findings
    }
  }
  return findings
}

export type ComponentReadFinding = ReturnType<typeof componentFindings>[number]

export const componentFindingsNote = (findings: readonly ComponentReadFinding[]) => findings.map(({ note }) => note)

type Spec = doom.ComponentDefinition["spec"]
type Signature = Pick<Spec, "name" | "collections" | "sample"> & {
  readonly id: string
  readonly revision: number
  readonly variants: NonNullable<Spec["variants"]>
  readonly defaultVariant: NonNullable<Spec["defaultVariant"]>
  readonly tokens: NonNullable<Spec["defaults"]>
  readonly overrides: typeof doom.linkedPartOverrides
}

export function componentSignature(id: string): Signature | undefined {
  const definition = doom.componentLibrary.get(id)
  if (definition === undefined) return undefined
  const { revision, spec } = definition
  return {
    id,
    name: spec.name,
    revision,
    collections: spec.collections,
    variants: spec.variants ?? {},
    defaultVariant: spec.defaultVariant ?? {},
    tokens: spec.defaults ?? {},
    sample: spec.sample,
    overrides: doom.linkedPartOverrides,
  }
}
