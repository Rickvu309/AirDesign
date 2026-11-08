import type {Id} from "../../../deck/src/model.ts"
import {parseTextBody} from "../../../deck/src/text/body-codec.ts"
import type {TextBody} from "../../../deck/src/text/body.ts"
import type {Node, Patch} from "../index.ts"

export function textBodyNodes(element: Id, input: TextBody): Node[] {
  const body = parseTextBody(input)
  const {id: frameId, ...frameFields} = body.frame
  return [{id: frameId, parent: element, order: 0, fields: frameFields}, ...body.paragraphs.map((paragraph, index) => {
    const {id, ...fields} = paragraph
    return {id, parent: element, order: index + 1, fields}
  })]
}
export function materializeTextBody(element: Id, nodes: readonly Node[]): TextBody {
  if (nodes.some(node => node.parent !== element) || nodes.some(node => !Number.isSafeInteger(node.order) || node.order < 0)) throw new Error("invalid-text-topology")
  const ordered = [...nodes].sort((a, b) => a.order - b.order)
  if (ordered.some((node, index) => node.order !== index)) throw new Error("invalid-text-order")
  const [frame, ...paragraphs] = ordered
  if (!frame || frame.fields.kind !== "text-frame" || paragraphs.some(node => node.fields.kind !== "paragraph")) throw new Error("invalid-text-topology")
  return parseTextBody({frame: {...frame.fields, id: frame.id}, paragraphs: paragraphs.map(node => ({...node.fields, id: node.id}))})
}
export type TextPropertyHead = {target: Id; key: string; seq: number}
export type TextBodyReplacement = {element: Id; before: TextBody; after: TextBody; historicalUsedIds: readonly Id[]; base: number; heads: readonly TextPropertyHead[]; adopts: boolean}
export function expandTextBodyReplacement(input: TextBodyReplacement): Patch[] {
  if (!Number.isSafeInteger(input.base) || input.base < 0) throw new Error("invalid-text-base")
  const previous = new Map(textBodyNodes(input.element, input.before).map(node => [node.id, node]))
  const next = new Map(textBodyNodes(input.element, input.after).map(node => [node.id, node]))
  if (next.has(input.element)) throw new Error("text-node-shadows-element")
  if (input.before.frame.id !== input.after.frame.id) throw new Error("text-frame-identity-changed")
  const patches: Patch[] = []
  for (const id of new Set([...previous.keys(), ...next.keys()])) {
    const before = previous.get(id) ?? null, after = next.get(id) ?? null
    if (!before && input.historicalUsedIds.includes(id)) throw new Error("node-id-reused")
    if (before && after && before.fields.kind !== after.fields.kind) throw new Error("text-node-kind-changed")
    const keys = !before || !after ? ["existence"] : [...new Set([...Object.keys(before.fields), ...Object.keys(after.fields)])].filter(key => JSON.stringify(before.fields[key]) !== JSON.stringify(after.fields[key]))
    if (before && after && before.order !== after.order) keys.push("order")
    if (!keys.length) continue
    if (input.heads.some(head => head.target === id && head.seq > input.base && (keys.includes(head.key) || head.key === "existence" || keys.includes("existence")))) throw new Error("stale-base")
    patches.push({id, before, after, keys, adopts: input.adopts, places: keys.includes("order")})
  }
  return patches
}
