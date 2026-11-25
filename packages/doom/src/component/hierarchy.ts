import { object, reject } from "../read-kit.js"
import { type Charge, id, string, type Values } from "./values.js"

const readRow = object({ id, parent: string })

type Placement = {
  id: string
  parent: string
  depth: number
  index: number
  slot: number
  children: number
  focused: boolean
}

export function hierarchy(source: Values, focus: string, charge: Charge) {
  charge(8 * source.length)
  const inputs = source.map(readRow)
  const indices = new Map(inputs.map(({ id }, index) => [id, index]))
  if (indices.size !== inputs.length) return reject("shape", "Hierarchy rows need distinct IDs.")

  const children = new Map<string, string[]>()
  let broken = 0
  for (const row of inputs) {
    const parent = indices.has(row.parent) ? row.parent : ""
    if (row.parent !== parent) broken += 1
    const group = children.get(parent) ?? []
    group.push(row.id)
    children.set(parent, group)
  }

  const rows: Placement[] = []
  const seen = new Set<string>()
  let levels = 0
  let leaves = 0
  let roots = 0
  function visit(id: string, parent: string, depth: number): Placement {
    seen.add(id)
    const index = indices.get(id) ?? reject("shape", "A hierarchy row.")
    const row = { id, parent, depth, index, slot: 0, children: 0, focused: id === focus }
    rows.push(row)
    levels = Math.max(levels, depth + 1)
    const first = leaves
    for (const child of children.get(id) ?? []) {
      if (seen.has(child)) {
        broken += 1
        continue
      }
      row.children += 1
      if (visit(child, id, depth + 1).focused) row.focused = true
    }
    if (row.children === 0) leaves += 1
    row.slot = (first + leaves - 1) / 2
    return row
  }

  for (const id of children.get("") ?? []) {
    visit(id, "", 0)
    roots += 1
  }
  for (const { id } of inputs) {
    if (seen.has(id)) continue
    visit(id, "", 0)
    roots += 1
  }
  return { rows, levels, leaves, roots, broken }
}
