import { landedPatch, type Register } from "./decide.js"
import type { ElementId } from "./element-id.js"
import type { Member } from "./element-group.js"
import type { FieldEdit } from "./row.js"
import { openingElement } from "./slide-floor.js"

type Flag = "mask" | "hidden"

function flagEdit(register: Register, node: ElementId, flag: Flag): FieldEdit<unknown> | undefined {
  const body = Object.hasOwn(register.elements, node) ? register.elements[node] : undefined
  return body === undefined ? undefined : landedPatch(body, "text").identity?.[flag]
}

function flagNow(register: Register, node: ElementId, flag: Flag): boolean {
  const edit = flagEdit(register, node, flag)
  if (typeof edit === "object") return edit.set === true
  if (edit === "inherit") return false
  return openingElement(register, node)?.design?.[`identity.${flag}`]?.[0] === true
}

export function shownMask(register: Register, node: ElementId): boolean {
  return flagNow(register, node, "mask") && !flagNow(register, node, "hidden")
}

export function maskTurned(register: Register, node: ElementId): boolean {
  if (typeof flagEdit(register, node, "mask") === "object") return true
  return typeof flagEdit(register, node, "hidden") === "object" && flagNow(register, node, "mask")
}

export function fittingMembers(register: Register, members: readonly Member[]): readonly Member[] {
  const masks = members.filter((member) => shownMask(register, member.node))
  return masks.length === 0 ? members : masks
}
