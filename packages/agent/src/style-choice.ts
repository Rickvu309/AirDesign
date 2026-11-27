import type * as doom from "@airdesign/doom"
import { style, styles } from "@airdesign/taste"

import { refused, type Answer } from "./answer.js"

export type StyleChoice = { readonly theme?: doom.Theme } | { readonly refusal: Answer }

export function styleChoice(requested: unknown, wanted: unknown): StyleChoice {
  const chosen = style(requested)
  if (requested !== undefined && chosen === undefined) {
    const ids = styles.map(({ id }) => id).join(", ")
    return { refusal: refused("field", { field: "style", fault: "form", form: `One of ${ids}.` }) }
  }
  if (wanted === undefined) return chosen === undefined ? {} : { theme: chosen.theme }
  if (chosen === undefined) return { refusal: refused("field", { field: "style", fault: "missing" }) }
  const variant = chosen.variants.find(({ name }) => name === wanted)
  if (variant !== undefined) return { theme: variant.theme }
  const names = chosen.variants.map(({ name }) => name).join(", ")
  return { refusal: refused("field", { field: "variant", fault: "form", form: `One of ${names}.` }) }
}
