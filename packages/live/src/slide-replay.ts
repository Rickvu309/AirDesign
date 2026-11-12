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

function applySlideRow(register: Register, row: SlideRow): Register {
  const decision = decide(register, { command: "slide", file: row.slideFile, edit: row.slideEdit })
  if (decision.decision !== "apply") throw new Error("person edit refused")
  return decision.register
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
    current = applySlideRow(current, slide)
  }
  for (const row of pending) {
    const slide = slideRow(row)
    if (slide !== null) {
      const decision = decide(current, { command: "slide", file: slide.slideFile, edit: slide.slideEdit })
      if (decision.decision === "apply") current = decision.register
      else if (decision.code !== "dead") throw new Error("person edit refused")
      continue
    }
    if (row.node === undefined || !current.nodes.includes(row.node)) throw new Error("missing node")
    const body = current.elements[row.node]
    if (body === undefined) throw new Error("missing node")
    if (row.base !== version(body)) continue
    const decision = decide(current, { command: "person", ...storedValue(row), node: row.node })
    if (decision.decision === "apply") current = decision.register
    else if (decision.code !== "dead") throw new Error("person edit refused")
  }
  return current
}
