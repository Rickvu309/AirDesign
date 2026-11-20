import { fitTags } from "./body-read.js"
import { withChild } from "./slot-edit.js"
import { bodyEdited } from "./trait-xml-body.js"
import type { ElementAt, Parts } from "./xml-codec.js"

export type ShrinkFit = { readonly scale: number; readonly reduction: number }

const whole = 100_000

function percent(name: string, share: number, none: number): string {
  const value = Math.round(share * whole)
  return value === none ? "" : ` ${name}="${String(value)}"`
}

export function shrunkBody(parts: Parts, at: ElementAt, fit: ShrinkFit): Parts {
  const fitted = `<a:normAutofit${percent("fontScale", fit.scale, whole)}${percent("lnSpcReduction", fit.reduction, 0)}/>`
  return bodyEdited(parts, at, withChild("a:bodyPr", Object.values(fitTags), "a:normAutofit", fitted))
}
