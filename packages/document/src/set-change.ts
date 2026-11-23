import type { Role } from "./design.js"
import { type ElementId, type SlideId } from "./element-id.js"
import {
  type AlphaField,
  type FieldName,
  type FieldValue,
  type HasAlpha,
  type InheritableField,
  type InputKinds,
  type InputName,
  type TraitName,
} from "./traits.js"
import type { Alpha, ValueOf } from "./value-kind.js"

export type Target =
  | { readonly node: ElementId }
  | { readonly nodes: readonly ElementId[] }
  | { readonly slide: SlideId }
  | { readonly role: Role; readonly slide: SlideId | "every" }

export type TraitInput<T extends TraitName> = {
  readonly [F in Exclude<FieldName<T>, AlphaField<T>>]?:
    | FieldValue<T, F>
    | (F extends InheritableField<T> ? null : never)
} & {
  readonly [I in InputName<T>]?: ValueOf<InputKinds<T>[I]> | (I extends InheritableField<T> ? null : never)
}

export type TraitInputs = { readonly [T in TraitName]?: TraitInput<T> }

export type ElementInputs = HasAlpha extends true ? { readonly opacity?: Alpha } : Record<never, never>

export type SetChange = { readonly target: Target } & ElementInputs & TraitInputs
