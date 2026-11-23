import { type FieldName, type FieldValue, type TraitName } from "./traits.js"

export type FieldEdit<V> = { readonly set: V } | "inherit" | "opening"

export type TraitPatch<T extends TraitName> = { readonly [F in FieldName<T>]?: FieldEdit<FieldValue<T, F>> }

export type ElementPatch = { readonly [T in TraitName]?: TraitPatch<T> }
