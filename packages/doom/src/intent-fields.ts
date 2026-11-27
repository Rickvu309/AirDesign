import {
  type Reader,
  boolean,
  explain,
  finite,
  expectationOf,
  literal,
  rememberExpectation,
  words,
} from "./read-kit.js"

type JsonSchema = Readonly<Record<string, unknown>>
export type Field<T> = { readonly schema: JsonSchema; readonly read: Reader<T> }

export const field = <T>(schema: JsonSchema, read: Reader<T>): Field<T> => {
  const accepted = expectationOf(read)
  const wrapped: Reader<T> = (raw) => {
    try {
      return read(raw)
    } catch (thrown) {
      explain(thrown, accepted)
      throw thrown
    }
  }
  if (accepted !== undefined) rememberExpectation(wrapped, accepted)
  return { schema, read: wrapped }
}

export const choice = <const V extends string>(values: readonly V[]) => field<V>({ enum: values }, literal(values))

export const number = (min: number, max: number) =>
  field<number>({ type: "number", minimum: min, maximum: max }, finite(min, max))

export const flag = () => field<boolean>({ type: "boolean" }, boolean)

export const string = (maxBytes: number) => field<string>({ type: "string" }, words(maxBytes, 1))
