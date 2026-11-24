import { type Reader, boolean, explain, finite, formOf, literal, rememberForm, words } from "./read-kit.js"

type JsonSchema = Readonly<Record<string, unknown>>
export type Field<T> = { readonly schema: JsonSchema; readonly read: Reader<T> }

export const field = <T>(schema: JsonSchema, read: Reader<T>): Field<T> => {
  const accepted = formOf(read)
  const wrapped: Reader<T> = (raw) => {
    try {
      return read(raw)
    } catch (thrown) {
      explain(thrown, accepted)
      throw thrown
    }
  }
  if (accepted !== undefined) rememberForm(wrapped, accepted)
  return { schema, read: wrapped }
}

export const choice = <const V extends string>(values: readonly V[], description?: string) =>
  field<V>({ enum: values, ...(description === undefined ? {} : { description }) }, literal(values))

export const number = (min: number, max: number, description: string) =>
  field<number>({ type: "number", minimum: min, maximum: max, description }, finite(min, max))

export const flag = (description: string) => field<boolean>({ type: "boolean", description }, boolean)

export const string = (maxBytes: number, description: string) =>
  field<string>({ type: "string", description }, words(maxBytes, 1))
