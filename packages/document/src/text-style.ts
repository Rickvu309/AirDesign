import type { Register } from "./decide.js"
import type { Color } from "./color.js"
import { bytesOf } from "./limits.js"
import { record } from "./plain-object.js"
import { text } from "./trait-text.js"
import type { ParagraphAlign } from "./text-value.js"
import { readValue } from "./value-kind.js"

export type TextStyleFields = {
  readonly font?: string
  readonly size?: number
  readonly bold?: boolean
  readonly italic?: boolean
  readonly color?: Color
  readonly align?: ParagraphAlign
  readonly letterSpacing?: number
  readonly lineSpacing?: number
  readonly spaceBefore?: number
  readonly spaceAfter?: number
}
export type TextStyle = {
  readonly id: string
  readonly name: string
  readonly fields: TextStyleFields
}

export const textStyleKeys = [
  "font",
  "size",
  "bold",
  "italic",
  "color",
  "align",
  "letterSpacing",
  "lineSpacing",
  "spaceBefore",
  "spaceAfter",
] as const

export function readTextStyles(raw: unknown): readonly TextStyle[] | null {
  if (!Array.isArray(raw) || raw.length > 128) return null
  const styles: TextStyle[] = []
  for (const item of raw) {
    const row = record(item)
    if (row === null || Object.keys(row).some((key) => !["id", "name", "fields"].includes(key))) return null
    if (typeof row.id !== "string" || row.id.length === 0 || bytesOf(row.id) > 200) return null
    if (typeof row.name !== "string" || row.name.length === 0 || bytesOf(row.name) > 200) return null
    const fields = record(row.fields)
    if (fields === null || Object.keys(fields).length === 0) return null
    for (const [key, value] of Object.entries(fields)) {
      const name = textStyleKeys.find((name) => name === key)
      if (name === undefined || readValue<unknown>(text.inputs[name], value) === null) return null
    }
    if (styles.some((style) => style.id === row.id)) return null
    styles.push({ id: row.id, name: row.name, fields })
  }
  return styles
}

export function textStylesOf(register: Register, slide: string): readonly TextStyle[] {
  const slides = register.index?.slides ?? []
  let source = slide
  for (let count = 0; count <= register.order.length; count += 1) {
    const styles = slides.find((each) => each.id === source)?.textStyles
    if (styles !== undefined) {
      const resolved = typeof styles === "string" ? slides.find((each) => each.id === styles)?.textStyles : styles
      return typeof resolved === "string" ? [] : (resolved ?? [])
    }
    const birth = register.order.find(
      (command) => (command.slide === "add" || command.slide === "clone") && command.id === source,
    )
    if (birth?.slide === "add") source = birth.layout
    else if (birth?.slide === "clone") source = birth.source
    else return []
  }
  return []
}
