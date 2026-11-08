import type {Id} from "../../../deck/src/model.ts"
import {isTextBody, parseTextBody} from "../../../deck/src/text/body-codec.ts"
import type {TextBody} from "../../../deck/src/text/body.ts"
import type {Node} from "../index.ts"

export function textBodyNodes(element: Id, input: TextBody): Node[] {
  if (!isTextBody(input)) throw new Error("invalid-text-body")
  const body = input
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
