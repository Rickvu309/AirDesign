import { color, pictureSource, readValue, union, type ValueOf } from "./value-kind.js"
import { gradient } from "./trait-fills.js"

export const textFill = union({ solid: color, gradient, image: pictureSource }, "solid")
export type TextFill = ValueOf<typeof textFill>
export const readTextFill = (value: unknown): TextFill | null => readValue(textFill, value)
