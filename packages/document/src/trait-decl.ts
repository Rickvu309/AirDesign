import type { Fields } from "./value-kind.js"

export type Inherit = "own" | "field" | "whole" | "run"

export type Stamp = { readonly version: number; readonly shape: string }

export type TraitDecl<
  F extends Fields,
  I extends Fields,
  H extends (keyof F | keyof I) & string = never,
  S extends keyof F & string = never,
> = {
  readonly inherits: Inherit
  readonly stamp: Stamp
  readonly fields: F
  readonly inputs: I
  readonly inheritable: readonly H[]
  readonly slots: readonly S[]
}

export type NoInputs = Record<never, never>

const noInputs: NoInputs = {}

export function trait<const F extends Fields>(inherits: Inherit, stamp: Stamp, fields: F): TraitDecl<F, NoInputs>
export function trait<
  const F extends Fields,
  const I extends Fields,
  const H extends (keyof F | keyof I) & string = never,
  const S extends keyof F & string = never,
>(
  inherits: Inherit,
  stamp: Stamp,
  fields: F,
  inputs: I,
  inheritable?: readonly H[],
  slots?: readonly S[],
): TraitDecl<F, I, H, S>
export function trait(
  inherits: Inherit,
  stamp: Stamp,
  fields: Fields,
  inputs?: Fields,
  inheritable?: readonly string[],
  slots?: readonly string[],
): TraitDecl<Fields, Fields, string, string> {
  return { inherits, stamp, fields, inputs: inputs ?? noInputs, inheritable: inheritable ?? [], slots: slots ?? [] }
}
