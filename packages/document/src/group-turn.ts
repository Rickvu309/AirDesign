import { decide, type Command, type Register } from "./decide.js"
import type { ElementId, SlideId } from "./element-id.js"
import { format } from "./format.js"
import { refrozenRows } from "./frame-layout.js"
import { ungroupRows, type Freed, type PlacedRow } from "./group-place.js"
import { regroupedRows } from "./group-space.js"

function opened(register: Register, node: ElementId): Register | null {
  if (register.nodes.includes(node)) return register
  const decision = decide(register, { command: "add", node, floor: register.floor, route: register.route })
  return decision.decision === "apply" ? decision.register : null
}

function landed(register: Register, commands: readonly Command[]): Register | null {
  let current = register
  for (const command of commands) {
    const ready = command.command === "person" && command.node !== undefined ? opened(current, command.node) : current
    const decision = ready === null ? null : decide(ready, command)
    if (decision === null || decision.decision !== "apply") return null
    current = decision.register
  }
  return current
}

function personRows(rows: readonly PlacedRow[]): readonly Command[] {
  return rows.map((row): Command => ({ command: "person", v: format, patch: row.patch, node: row.node }))
}

export function ungroupTurn(
  register: Register,
  file: readonly SlideId[],
  slide: SlideId,
  node: ElementId,
  freed: Freed = "laid",
): readonly Command[] | null {
  const rows = ungroupRows(register, node, freed)
  if (rows === null) return null
  const commands: Command[] = [
    { command: "slide", file, edit: { slide: "element-ungroup", id: slide, node } },
    ...personRows(rows),
  ]
  return landed(register, commands) === null ? null : commands
}

export function regroupTurn(
  register: Register,
  file: readonly SlideId[],
  slide: SlideId,
  node: ElementId,
): readonly Command[] | null {
  const regroup: Command = { command: "slide", file, edit: { slide: "element-regroup", id: slide, node } }
  const formed = landed(register, [regroup])
  if (formed === null) return null
  const commands = [regroup, ...personRows([...refrozenRows(formed, node), ...regroupedRows(register, formed, node)])]
  return landed(register, commands) === null ? null : commands
}
