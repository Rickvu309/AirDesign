import { columnDefinition } from "../library.js"
import {
  type Doom,
  type Edit,
  type Landed,
  type Write,
  applyEdit,
  defaultTheme,
  doomFromTree,
  isRefusal,
  measureWith,
  nodeId,
  orderKeyBetween,
  rev,
  placeComponent,
  regenerateComponent,
} from "../../index.js"

export const frame = nodeId("linked:1")
let counter = 1
export const mint = () => nodeId(`linked:${++counter}`)
export const at = orderKeyBetween(null, null)
export const box = { x: 190, y: 210, w: 1540, h: 650, rotation: 0, flipH: false, flipV: false }
export const person: Edit["author"] = { kind: "person", id: "person" }
export const data = (first: number, second: number) => ({
  rows: [
    { id: "a", label: "A", value: first },
    { id: "b", label: "B", value: second },
  ],
})
export const measure = measureWith({})

export function placed() {
  const { doom: before, slides } = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }] })
  const writes = placeComponent(before, columnDefinition, {
    frame,
    parent: { id: slides[0]!, at },
    box,
    data: data(1, 2),
    measure,
  })
  if (isRefusal(writes)) throw new Error(JSON.stringify(writes))
  return land(before, writes, true)
}

export function land(before: Doom, writes: readonly Write[], guard = false) {
  const edit: Landed = {
    author: person,
    once: `edit-${before.rev + 1}`,
    rev: rev(before.rev + 1),
    writes: writes.map((write) => {
      const base = before.revs.get(write.node)?.get(write.prop)
      return base === undefined ? write : { ...write, base }
    }),
    ...(guard ? { readBase: before.rev } : {}),
  }
  const after = applyEdit(before, edit)
  if (isRefusal(after)) throw new Error(JSON.stringify(after))
  return after
}

export function instance(fold: Doom) {
  const root = fold.nodes.get(frame)
  if (root?.type !== "frame" || root.instance === undefined) throw new Error("Missing instance")
  return root.instance
}

export function part(fold: Doom, role: string, id: string) {
  const found = instance(fold).parts.find(({ key }) => key[0] === role && key[1] === id)
  if (found === undefined) throw new Error(`Missing ${role}/${id}`)
  return found.node
}

export function refresh(fold: Doom, patch: Parameters<typeof regenerateComponent>[2]) {
  const writes = regenerateComponent(fold, frame, patch, measure)
  if (isRefusal(writes)) throw new Error(JSON.stringify(writes))
  return writes.writes
}
