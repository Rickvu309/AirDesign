import { designCopy } from "@/copy/design-copy"
import { placeholderRoles } from "@/copy/placeholder-copy"

export type NamedNode = { readonly name: string; readonly kind: string }

const rawId = /^([A-Za-z]+) ?\d+$/

function kindWord(kind: string): string {
  const words: Readonly<Record<string, string>> = designCopy.panels
  return words[kind] ?? designCopy.panels.kept
}

function spoken(node: NamedNode): { readonly label: string; readonly given: boolean } {
  const role = placeholderRoles[rawId.exec(node.name.trim())?.[1] ?? ""]
  if (role !== undefined) return { label: role, given: false }
  const name = node.name.trim()
  return name === "" ? { label: kindWord(node.kind), given: false } : { label: name, given: true }
}

export function plainNames(nodes: readonly NamedNode[]): readonly string[] {
  const words = nodes.map(spoken)
  const seen = new Map<string, number>()
  const total = new Map<string, number>()
  for (const { label, given } of words) if (!given) total.set(label, (total.get(label) ?? 0) + 1)
  return words.map(({ label, given }) => {
    if (given || (total.get(label) ?? 0) < 2) return label
    const at = (seen.get(label) ?? 0) + 1
    seen.set(label, at)
    return `${label} ${at}`
  })
}
