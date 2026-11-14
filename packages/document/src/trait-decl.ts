import type { Fields } from "./value-kind.js"

export type Inherit = "own" | "field" | "whole" | "run"

export type Stamp = { readonly version: number; readonly shape: string }

export type TraitDecl<F extends Fields, I extends Fields> = {
  readonly inherits: Inherit
  readonly stamp: Stamp
  readonly fields: F
  readonly inputs: I
}

export type NoInputs = Record<never, never>

const noInputs: NoInputs = {}

export function trait<const F extends Fields>(inherits: Inherit, stamp: Stamp, fields: F): TraitDecl<F, NoInputs>
export function trait<const F extends Fields, const I extends Fields>(
  inherits: Inherit,
  stamp: Stamp,
  fields: F,
  inputs: I,
): TraitDecl<F, I>
export function trait(inherits: Inherit, stamp: Stamp, fields: Fields, inputs?: Fields): TraitDecl<Fields, Fields> {
  return { inherits, stamp, fields, inputs: inputs ?? noInputs }
}
