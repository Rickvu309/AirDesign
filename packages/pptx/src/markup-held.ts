import type { Source } from "@airdesign/document"
import type { MarkupElement } from "./element-span.js"
import { paintAttribute } from "./paint-color.js"
import { paintChild } from "./paint-fill.js"
import type { MarkupChildren } from "./text-value-route.js"

export type Held = { readonly element: MarkupElement; readonly children: MarkupChildren; readonly source?: Source }

export const inside = (held: Held): readonly MarkupElement[] => held.children[held.element.index] ?? []

export const child = (held: Held | undefined, kind: string): Held | undefined => {
  if (held === undefined) return undefined
  const element = paintChild(held.children, held.element, kind)
  return element === undefined ? undefined : { ...held, element }
}

export const whole = (element: MarkupElement, name: string): number | undefined => {
  const value = paintAttribute(element, name)
  if (value === null || !/^[+-]?\d+$/.test(value)) return undefined
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : undefined
}

export const flag = (element: MarkupElement, name: string): boolean | undefined => {
  const value = paintAttribute(element, name)
  if (value === "1" || value === "true") return true
  if (value === "0" || value === "false") return false
  return undefined
}
