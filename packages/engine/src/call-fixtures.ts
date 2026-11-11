import { decide, type Register, type ElementId } from "@airdesign/document"
export function nodeBody(register: Register, id: ElementId) {
  const body = register.elements[id]
  if (body === undefined) throw new Error("missing node")
  return body
}

export function include(register: Register, id: ElementId): Register {
  if (register.nodes.includes(id)) return register
  const added = decide(register, { command: "add", node: id, floor: register.floor, route: register.route })
  if (added.decision !== "apply") throw new Error(added.code)
  return added.register
}
