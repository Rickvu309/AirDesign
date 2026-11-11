import { rootElement, type Register, type NodeRegister } from "@airdesign/document"
export function opened(register: Register): NodeRegister {
  const body = register.elements[rootElement]
  if (body === undefined) throw new Error("missing node")
  return body
}

export function viewed(register: Register) {
  return { ...register, ...opened(register) }
}

export function personSplit(register: NodeRegister): { personBefore: number; personAfter: number } {
  let personBefore = 0
  let personAfter = 0
  let seenAgent = false
  for (const row of register.landed) {
    if (row.actor === "agent") {
      seenAgent = true
      continue
    }
    if (!row.visible) continue
    if (seenAgent) personAfter += 1
    else personBefore += 1
  }
  return { personBefore, personAfter }
}
