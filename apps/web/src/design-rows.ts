import { landedPatch, type ElementId, type ElementPatch, type Register } from "@airdesign/document"

const livePainted: readonly string[] = ["box", "text", "notes", "table"]

export function designRows(register: Register | null): readonly (readonly [ElementId, ElementPatch])[] {
  if (register === null) return []
  return register.nodes.flatMap((node) => {
    const body = register.elements[node]
    if (body === undefined) return []
    const patch = Object.entries(landedPatch(body, "text")).filter(([trait]) => !livePainted.includes(trait))
    return patch.length === 0 ? [] : [[node, Object.fromEntries(patch) as ElementPatch] as const]
  })
}
