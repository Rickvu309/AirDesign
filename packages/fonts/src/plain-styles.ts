import { boldWeight, regularWeight, type FontStyle } from "./named-face.js"

export const plainStyles: readonly FontStyle[] = [regularWeight, boldWeight].flatMap((weight) => [
  { weight, italic: false },
  { weight, italic: true },
])
