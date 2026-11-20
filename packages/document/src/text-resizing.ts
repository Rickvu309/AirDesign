import { landedPatch, type Register } from "./decide.js"
import type { ElementId } from "./element-id.js"
import type { ElementPatch, FieldEdit } from "./row.js"
import { openingElement } from "./slide-floor.js"
import type { autofits } from "./trait-body.js"

export const textResizings = ["auto-width", "auto-height", "fixed"] as const

export type TextResizing = (typeof textResizings)[number]

const flush = { left: 0, top: 0, right: 0, bottom: 0 }

export function textOpening(resizing: TextResizing): ElementPatch {
  return {
    body: {
      insets: { set: flush },
      wrap: { set: resizing !== "auto-width" },
      autofit: { set: resizing === "fixed" ? "none" : "grow" },
    },
  }
}

type Autofit = FieldEdit<(typeof autofits)[number]> | undefined

export function hugsText(register: Register, node: ElementId): boolean {
  const opened: Autofit = openingElement(register, node)?.opening?.body?.autofit
  const body = Object.hasOwn(register.elements, node) ? register.elements[node] : undefined
  const landed: Autofit = body === undefined ? undefined : landedPatch(body, "text").body?.autofit
  const now = landed === undefined || landed === "opening" ? opened : landed
  return typeof now === "object" && now.set === "grow"
}
