import { decide, type Command, type Register } from "./decide.js"
import type { ElementId, SlideId } from "./element-id.js"
import { format } from "./format.js"
import { ungroupRows } from "./group-place.js"

function opened(register: Register, node: ElementId): Register | null {
  if (register.nodes.includes(node)) return register
  const decision = decide(register, { command: "add", node, floor: register.floor, route: register.route })
  return decision.decision === "apply" ? decision.register : null
}

export function ungroupTurn(
  register: Register,
  file: readonly SlideId[],
  slide: SlideId,
  node: ElementId,
): readonly Command[] | null {
  const rows = ungroupRows(register, node)
  if (rows === null) return null
  const commands: Command[] = [
    { command: "slide", file, edit: { slide: "element-ungroup", id: slide, node } },
    ...rows.map((row): Command => ({ command: "person", v: format, patch: row.patch, node: row.node })),
  ]
  let current = register
  for (const command of commands) {
    const ready = command.command === "person" && command.node !== undefined ? opened(current, command.node) : current
    const decision = ready === null ? null : decide(ready, command)
    if (decision === null || decision.decision !== "apply") return null
    current = decision.register
  }
  return commands
}
