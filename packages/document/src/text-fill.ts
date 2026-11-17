import { color, readValue, union, type ValueOf } from "./value-kind.js"
import { gradient } from "./trait-fill.js"

export const textFill = union({ solid: color, gradient }, "solid")
export type TextFill = ValueOf<typeof textFill>
export const readTextFill = (value: unknown): TextFill | null => readValue(textFill, value)
