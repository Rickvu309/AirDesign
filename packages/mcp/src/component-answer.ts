import * as doom from "@airdesign/doom"

const estimate = doom.measureWith({})
const shownFindings = 10

type FindingMessage = { readonly kind: string } & (
  | { readonly neededWidth: number; readonly availableWidth: number; readonly thinned?: number }
  | { readonly message: string }
)

function findingMessage(finding: FindingMessage): string {
  if ("message" in finding) return finding.message
  const { neededWidth, availableWidth, thinned } = finding
  return `needs ${Math.ceil(neededWidth)} px in ${Math.floor(availableWidth)} px${thinned === undefined ? "." : `, with ${thinned} labels thinned.`}`
}

export function componentFindings(fold: doom.Doom, ids: readonly doom.NodeId[], measure = estimate) {
  const findings: { node: doom.NodeId; code: string; key: doom.PartKey; note: string }[] = []
  for (const node of new Set(ids)) {
    const tree = doom.componentTree(fold, node, measure)
    if (doom.isRefusal(tree)) continue
    for (const finding of tree.findings) {
      const { kind, key } = finding
      const subject = `${node} ${key.join(" / ")}`
      const note = `${subject} ${findingMessage(finding)}`
      findings.push({ node, code: kind, key, note })
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
  readonly overrides: { readonly text: readonly string[]; readonly shapes: readonly string[] }
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
