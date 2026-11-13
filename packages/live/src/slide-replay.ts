import { decide, storedValue, version, type Register, type SlideCommand, type SlideId } from "@airdesign/document"

import type { ConfirmedRow, PendingRow } from "./store.js"

type SlideRow = { readonly slideFile: readonly SlideId[]; readonly slideEdit: SlideCommand }

function slideRow(row: {
  readonly slideFile?: readonly SlideId[]
  readonly slideEdit?: SlideCommand
}): SlideRow | null {
  if (row.slideEdit === undefined || row.slideFile === undefined) return null
  return { slideFile: row.slideFile, slideEdit: row.slideEdit }
}

function appliedSlide(register: Register, row: SlideRow): Register | null {
  const decision = decide(register, { command: "slide", file: row.slideFile, edit: row.slideEdit })
  return decision.decision === "apply" ? decision.register : null
}

export function landed(register: Register, row: PendingRow): Register | null {
  const slide = slideRow(row)
  if (slide !== null) return appliedSlide(register, slide)
  if (row.node === undefined) return null
  let current = register
  if (!current.nodes.includes(row.node)) {
    const opened = decide(current, {
      command: "add",
      node: row.node,
      floor: row.floor ?? current.floor,
      route: current.route,
    })
    if (opened.decision !== "apply") return null
    current = opened.register
  }
  const decision = decide(current, { command: "person", ...storedValue(row), node: row.node })
  return decision.decision === "apply" ? decision.register : null
}

export function refusedRows(register: Register, pending: readonly PendingRow[]): PendingRow[] {
  const refused: PendingRow[] = []
  let current = register
  for (const row of pending) {
    const next = landed(current, row)
    if (next === null) refused.push(row)
    else current = next
  }
  return refused
}

function staleText(register: Register, row: PendingRow): boolean {
  if (slideRow(row) !== null || row.node === undefined) return false
  const body = register.elements[row.node]
  return body !== undefined && row.base !== version(body)
}

export function withSlides(
  register: Register,
  confirmed: readonly ConfirmedRow[],
  pending: readonly PendingRow[],
): Register {
  let current = register
  for (const row of confirmed) {
    const slide = slideRow(row)
    if (slide === null) continue
    current = appliedSlide(current, slide) ?? current
  }
  for (const row of pending) {
    if (staleText(current, row)) continue
    current = landed(current, row) ?? current
  }
  return current
}
