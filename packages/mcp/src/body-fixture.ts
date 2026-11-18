import type { Box, ElementId, Kind, Register } from "@airdesign/document"
import { edit, elements, type Attempt } from "./score.js"

export const placed: Box = { x: 914_400, y: 914_400, cx: 3_657_600, cy: 2_743_200 }

export function bodyIs(kind: Kind | "photo"): (register: Register) => Register {
  const body = kind === "photo" ? { kind: "shape" as const, design: { fills: ["image"] as const } } : { kind }
  const rows = [
    { node: elements.title, kind: "shape" as const, value: "Title", box: placed, grouped: false },
    { node: elements.body, ...body, value: null, box: placed, grouped: false },
  ]
  return (register) => ({
    ...register,
    index: { total: rows.length, slides: [{ id: "258", position: 0 }], elements: rows, pages: [] },
  })
}

export function boxed(deck: string, box: Box, node: ElementId = elements.body, readAt = 0): Attempt {
  const call = edit(deck, [])
  return [{ name: call.name, raw: { deck, base: 0, changes: [{ node, readAt, property: "box", value: box }] } }]
}
