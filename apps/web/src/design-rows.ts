import { landedPatch, type ElementId, type ElementPatch, type Register } from "@airdesign/document"

const livePainted: readonly string[] = ["box.x", "box.y", "box.w", "box.h", "text", "notes"]

function painted(trait: string, fields: object | undefined): readonly (readonly [string, object])[] {
  if (livePainted.includes(trait) || fields === undefined) return []
  const kept = Object.entries(fields).filter(([field]) => !livePainted.includes(`${trait}.${field}`))
  return kept.length === 0 ? [] : [[trait, Object.fromEntries(kept)]]
}

export function designRows(register: Register | null): readonly (readonly [ElementId, ElementPatch])[] {
  if (register === null) return []
  return register.nodes.flatMap((node) => {
    const body = register.elements[node]
    if (body === undefined) return []
    const patch = Object.entries(landedPatch(body, "text")).flatMap(([trait, fields]) => painted(trait, fields))
    return patch.length === 0 ? [] : [[node, Object.fromEntries(patch) as ElementPatch] as const]
  })
}
