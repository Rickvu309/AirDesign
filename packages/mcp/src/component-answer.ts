import * as doom from "@airdesign/doom"

const estimate = doom.measureWith({})
const shownFindings = 10

function findingMessage(finding: doom.ComponentFinding): string {
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
      const { neededWidth, availableWidth, thinned, advice } = finding
      return `needs ${Math.ceil(neededWidth)} px in ${Math.floor(availableWidth)} px${thinned === undefined ? "." : `, with ${thinned} labels thinned.`}${advice === undefined ? "" : ` ${advice}`}`
    }
    case "text-overflow":
      return `needs ${finding.neededWidth}x${finding.neededHeight} px in a ${finding.availableWidth}x${finding.availableHeight} box.`
    case "outside-frame": {
      const { box, frame } = finding
      return `sits at ${box.x},${box.y} ${box.w}x${box.h}, outside the ${frame.w}x${frame.h} frame.`
    }
  }
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

type PlacedInstance = {
  readonly id: doom.NodeId
  readonly slide: doom.NodeId
  readonly box: unknown
  readonly data: unknown
  readonly variant: unknown
}

export function instancesOf(fold: doom.Doom, id: string): readonly PlacedInstance[] {
  return [...fold.nodes.values()].flatMap((node) => {
    const instance = doom.propOf(node, "instance")
    const slide = doom.slideOf(fold, node.id)
    if (instance === undefined || slide === undefined || (instance.component.id ?? instance.component.node) !== id)
      return []
    return [{ id: node.id, slide, box: doom.propOf(node, "box"), data: instance.data, variant: instance.variant }]
  })
}

function collectionWords(spec: unknown): string {
  const collections = (spec as { readonly collections?: Readonly<Record<string, object>> } | undefined)?.collections
  return Object.entries(collections ?? {})
    .map(([table, fields]) => `${table}: ${Object.keys(fields).join(", ")}`)
    .join("; ")
}

export function componentLines(fold: doom.Doom): readonly string[] {
  return [...fold.nodes.values()].flatMap((node) => {
    const found = doom.deckComponent(fold, node.id)
    if (found === undefined) return []
    const count = instancesOf(fold, node.id).length
    const fields = collectionWords(doom.propOf(node, "spec"))
    return [
      `${node.id} "${found.spec.name}" r${found.revision}, ${count} instances${fields === "" ? "" : `, ${fields}`}`,
    ]
  })
}

export function sampleFindings(fold: doom.Doom, ids: readonly doom.NodeId[], measure = estimate) {
  return ids
    .flatMap((id) => {
      const tree = doom.componentSampleTree(fold, id, measure)
      if (doom.isRefusal(tree)) return []
      return tree.findings.map((finding) => ({
        node: id,
        code: finding.kind === "advice" ? finding.code : finding.kind,
        key: finding.key,
        note: `${id} sample ${finding.key.join(" / ")} ${findingMessage(finding)}`,
      }))
    })
    .slice(0, shownFindings)
}
