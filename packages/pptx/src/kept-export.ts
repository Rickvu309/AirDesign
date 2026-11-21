import { floorNodes, type ElementId, type NodeRegister, type Register } from "@airdesign/document"
import { exportParts } from "./export-parts.js"
import type { ElementAt } from "./xml-codec.js"

type Parts = ReadonlyMap<string, Uint8Array>

export type LeftOutEdit = { readonly node: ElementId; readonly row: number | null }

export type KeptExport = { readonly parts: Parts; readonly leftOut: readonly LeftOutEdit[] }

type Media = ElementAt["media"]

const knownLeftOut = new WeakMap<Parts, Set<string>>()

function written(parts: Parts, register: Register, media: Media, skipped: ReadonlySet<ElementId>): Parts | null {
  try {
    return exportParts(parts, register, media, skipped)
  } catch {
    return null
  }
}

function rowsOf(register: Register, node: ElementId): NodeRegister["landed"] | undefined {
  const body = register.elements[node] as NodeRegister | null | undefined
  return register.nodes.includes(node) && Array.isArray(body?.landed) ? body.landed : undefined
}

function keyOf(register: Register, edit: LeftOutEdit): string {
  const row = edit.row === null ? null : (rowsOf(register, edit.node)?.[edit.row] ?? null)
  return JSON.stringify({ node: edit.node, row })
}

function withRows(register: Register, node: ElementId, kept: (row: number) => boolean): Register {
  const body = register.elements[node] as NodeRegister
  return {
    ...register,
    elements: { ...register.elements, [node]: { ...body, landed: body.landed.filter((_, row) => kept(row)) } },
  }
}

function pruned(register: Register, leftOut: readonly LeftOutEdit[]): Register {
  let next = register
  for (const node of new Set(leftOut.flatMap((edit) => (edit.row === null ? [] : [edit.node])))) {
    const rows = new Set(leftOut.flatMap((edit) => (edit.node === node && edit.row !== null ? [edit.row] : [])))
    next = withRows(next, node, (row) => !rows.has(row))
  }
  return next
}

function skippedOf(leftOut: readonly LeftOutEdit[]): ReadonlySet<ElementId> {
  return new Set(leftOut.flatMap((edit) => (edit.row === null ? [edit.node] : [])))
}

function firstUnwritable(
  parts: Parts,
  register: Register,
  media: Media,
  leftOut: readonly LeftOutEdit[],
): LeftOutEdit | null {
  const skipped = skippedOf(leftOut)
  const nodes = [...new Set([...register.nodes, ...floorNodes(register)])].filter((node) => !skipped.has(node))
  const through = (count: number) => new Set([...skipped, ...nodes.slice(count)])
  if (written(parts, pruned(register, leftOut), media, through(0)) === null) return null
  let writes = 0
  let fails = nodes.length
  while (fails - writes > 1) {
    const middle = Math.floor((writes + fails) / 2)
    if (written(parts, pruned(register, leftOut), media, through(middle)) === null) fails = middle
    else writes = middle
  }
  const node = nodes[fails - 1]
  if (node === undefined) return null
  const rows = rowsOf(register, node)
  const left = new Set(leftOut.flatMap((edit) => (edit.node === node && edit.row !== null ? [edit.row] : [])))
  const open = (rows ?? []).flatMap((_, row) => (left.has(row) ? [] : [row]))
  const prefix = (count: number) =>
    written(
      parts,
      withRows(pruned(register, leftOut), node, (row) => open.slice(0, count).includes(row)),
      media,
      through(fails),
    ) !== null
  if (rows === undefined || open.length === 0 || !prefix(0)) return { node, row: null }
  let good = 0
  let bad = open.length
  while (bad - good > 1) {
    const middle = Math.floor((good + bad) / 2)
    if (prefix(middle)) good = middle
    else bad = middle
  }
  return { node, row: open[bad - 1] ?? null }
}

export function keptExport(parts: Parts, register: Register, media?: Media): KeptExport {
  const whole = written(parts, register, media, new Set())
  if (whole !== null) return { parts: whole, leftOut: [] }
  const known = knownLeftOut.get(parts) ?? new Set<string>()
  knownLeftOut.set(parts, known)
  const leftOut: LeftOutEdit[] = [...register.nodes, ...floorNodes(register)].flatMap((node) => {
    const rows = rowsOf(register, node) ?? []
    const edits: LeftOutEdit[] = [{ node, row: null }, ...rows.map((_, row) => ({ node, row }))]
    return edits.filter((edit) => known.has(keyOf(register, edit)))
  })
  for (;;) {
    const done = written(parts, pruned(register, leftOut), media, skippedOf(leftOut))
    if (done !== null) return { parts: done, leftOut }
    const edit = firstUnwritable(parts, register, media, leftOut)
    if (edit === null) return { parts, leftOut: [...register.nodes].map((node) => ({ node, row: null })) }
    known.add(keyOf(register, edit))
    leftOut.push(edit)
  }
}
