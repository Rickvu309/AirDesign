import { format, openRegister, readRegister, rootElement, type Register, type NodeRegister } from "@airdesign/document"

export const traitRow = {
  v: format,
  patch: { box: { x: { set: 914_400 } }, text: { value: { set: "agent" } } },
} as const

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

export function storedRoot(fields: object) {
  const read = readRegister(JSON.parse(JSON.stringify({ ...openRegister("floor", "slide"), ...fields })))
  if (!read.ok) throw new Error(`stored register ${read.refusal}`)
  return viewed(read.value)
}
