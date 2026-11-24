import { bytesOf } from "./limits.js"

export type Reader<T> = (raw: unknown) => T
export type FieldFault = "missing" | "unknown" | "form"

export class Reject {
  readonly kind: "shape" | "limit"
  field: string | undefined
  fault: FieldFault | undefined
  form: string | undefined
  constructor(kind: "shape" | "limit", field?: string, fault?: FieldFault, form?: string) {
    this.kind = kind
    this.field = field
    this.fault = fault
    this.form = form
  }
}

let pending: Reject | undefined

export const reject = (kind: "shape" | "limit" = "shape"): never => {
  pending = undefined
  throw new Reject(kind)
}

const wrong = (form: string): never => {
  throw new Reject("shape", undefined, "form", form)
}

export function rejected(thrown: unknown): "shape" | "limit" {
  if (!(thrown instanceof Reject)) throw thrown
  pending = thrown
  return thrown.kind
}

export function takeRejection(kind: "shape" | "limit"): Reject | undefined {
  const found = pending
  pending = undefined
  return found?.kind === kind ? found : undefined
}

export const rejectedField = (thrown: unknown): string | undefined =>
  thrown instanceof Reject ? thrown.field : undefined

const forms = new WeakMap<Reader<unknown>, string>()
const genericForm = new Set(["An object.", "A list."])

export function rememberForm(read: Reader<unknown>, form: string): void {
  forms.set(read, form)
}

export function formOf(read: Reader<unknown>): string | undefined {
  return forms.get(read)
}

export function explain(thrown: unknown, form: string | undefined): void {
  if (!(thrown instanceof Reject) || thrown.kind !== "shape") return
  if (thrown.fault === undefined) thrown.fault = "form"
  if (form !== undefined && thrown.field === undefined && (thrown.form === undefined || genericForm.has(thrown.form)))
    thrown.form = form
}

function naming<T>(field: string, read: () => T): T {
  try {
    return read()
  } catch (thrown) {
    if (thrown instanceof Reject) {
      if (thrown.field === undefined) thrown.field = field
      else if (thrown.field !== field && !thrown.field.startsWith(`${field}.`))
        thrown.field = `${field}.${thrown.field}`
      if (thrown.fault === undefined && thrown.kind === "shape") thrown.fault = "form"
    }
    throw thrown
  }
}

const recordOf = (raw: unknown): Record<string, unknown> | undefined =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined

const plain = (raw: unknown): Record<string, unknown> => {
  const found = recordOf(raw)
  if (found === undefined) throw new Reject("shape", undefined, "form", "An object.")
  return found
}

export const boolean: Reader<boolean> = (raw) => (typeof raw === "boolean" ? raw : wrong("true or false."))

export const finite = (min: number, max: number): Reader<number> => {
  const form = `A number from ${min} to ${max}.`
  const read: Reader<number> = (raw) =>
    typeof raw === "number" && Number.isFinite(raw) && raw >= min && raw <= max ? raw : wrong(form)
  rememberForm(read, form)
  return read
}

export const integer = (min: number, max: number): Reader<number> => {
  const form = `A whole number from ${min} to ${max}.`
  const read: Reader<number> = (raw) =>
    typeof raw === "number" && Number.isInteger(raw) && raw >= min && raw <= max ? raw : wrong(form)
  rememberForm(read, form)
  return read
}

const unsafe =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/

export const words = (maxBytes: number, minLength = 0): Reader<string> => {
  const empty = minLength > 0 ? "A non-empty string." : "A string."
  const read: Reader<string> = (raw) => {
    if (typeof raw !== "string") return wrong("A string.")
    if (raw.length < minLength) return wrong(empty)
    if (unsafe.test(raw)) return wrong("A string with no control characters or lone surrogates.")
    return bytesOf(raw) > maxBytes ? reject("limit") : raw
  }
  rememberForm(read, empty)
  return read
}

export const matching =
  (pattern: RegExp, maxLength: number): Reader<string> =>
  (raw) =>
    typeof raw === "string" && raw.length <= maxLength && pattern.test(raw) ? raw : reject()

export const literal =
  <const V extends string>(values: readonly V[]): Reader<V> =>
  (raw) => {
    const form = `One of ${values.join(", ")}.`
    return typeof raw === "string" && (values as readonly string[]).includes(raw) ? (raw as V) : wrong(form)
  }

export const list = <T>(item: Reader<T>, max: number, min = 0): Reader<readonly T[]> => {
  const form = min <= 1 ? "A list of at least one." : `A list of at least ${min}.`
  const read: Reader<readonly T[]> = (raw) => {
    if (!Array.isArray(raw)) return wrong("A list.")
    if (raw.length < min) return wrong(min === 0 ? "A list." : form)
    if (raw.length > max) return reject("limit")
    return raw.map((value, index) => naming(String(index), () => item(value)))
  }
  rememberForm(read, min === 0 ? "A list." : form)
  return read
}

export const pair =
  <T>(item: Reader<T>): Reader<readonly [T, T]> =>
  (raw) => {
    if (!Array.isArray(raw) || raw.length !== 2) return wrong("Two values.")
    return [naming("0", () => item(raw[0])), naming("1", () => item(raw[1]))]
  }

export const quad =
  <T>(item: Reader<T>): Reader<readonly [T, T, T, T]> =>
  (raw) => {
    if (!Array.isArray(raw) || raw.length !== 4) return wrong("Four values.")
    return [
      naming("0", () => item(raw[0])),
      naming("1", () => item(raw[1])),
      naming("2", () => item(raw[2])),
      naming("3", () => item(raw[3])),
    ]
  }

export const oneOf =
  <T>(...readers: readonly Reader<T>[]): Reader<T> =>
  (raw) => {
    let kind: "shape" | "limit" = "shape"
    for (const reader of readers) {
      try {
        return reader(raw)
      } catch (thrown) {
        if (!(thrown instanceof Reject)) throw thrown
        if (thrown.kind === "limit") kind = "limit"
      }
    }
    return reject(kind)
  }

type Shape = Readonly<Record<string, Reader<unknown>>>
type Required<R extends Shape> = { readonly [K in keyof R]: ReturnType<R[K]> }
type Optional<O extends Shape> = { readonly [K in keyof O]?: ReturnType<O[K]> }

export function object<R extends Shape, O extends Shape = Record<never, never>>(
  required: R,
  optional?: O,
): Reader<Required<R> & Optional<O>> {
  const allowed = new Set([...Object.keys(required), ...Object.keys(optional ?? {})])
  const accepted = `One of ${[...allowed].join(", ")}.`
  return (raw) => {
    const found = plain(raw)
    for (const key of Object.keys(found)) if (!allowed.has(key)) throw new Reject("shape", key, "unknown", accepted)
    const read: Record<string, unknown> = {}
    for (const [key, reader] of Object.entries(required)) {
      if (!Object.hasOwn(found, key)) throw new Reject("shape", key, "missing", formOf(reader) ?? accepted)
      read[key] = naming(key, () => reader(found[key]))
    }
    for (const [key, reader] of Object.entries(optional ?? {}))
      if (Object.hasOwn(found, key)) read[key] = naming(key, () => reader(found[key]))
    return read as Required<R> & Optional<O>
  }
}

export const keyed =
  <const K extends string, T>(keys: readonly K[], item: Reader<T>): Reader<Readonly<Record<K, T>>> =>
  (raw) => {
    const found = plain(raw)
    if (Object.keys(found).length !== keys.length) reject()
    const read: Partial<Record<K, T>> = {}
    for (const key of keys) {
      if (!Object.hasOwn(found, key)) reject()
      read[key] = item(found[key])
    }
    return read as Readonly<Record<K, T>>
  }

export const dictionary =
  <T>(key: RegExp, item: Reader<T>, max: number): Reader<Readonly<Record<string, T>>> =>
  (raw) => {
    const found = plain(raw)
    const names = Object.keys(found)
    if (names.length > max) reject("limit")
    const read: Record<string, T> = {}
    for (const name of names) {
      if (!key.test(name)) reject()
      read[name] = item(found[name])
    }
    return read
  }

type Variants<Tag extends string> = Readonly<Record<string, Reader<object>>> & { readonly [K in Tag]?: never }

export function variant<const Tag extends string, V extends Variants<Tag>>(
  tag: Tag,
  variants: V,
): Reader<{ [N in keyof V & string]: { readonly [T in Tag]: N } & ReturnType<V[N]> }[keyof V & string]> {
  const accepted = `One of ${Object.keys(variants).join(", ")}.`
  return (raw) => {
    const found = recordOf(raw)
    if (found === undefined) throw new Reject("shape", tag, "form", "An object.")
    const name = found[tag]
    if (name === undefined) throw new Reject("shape", tag, "missing", accepted)
    if (typeof name !== "string") throw new Reject("shape", tag, "form", accepted)
    if (!Object.hasOwn(variants, name)) throw new Reject("shape", tag, "unknown", accepted)
    const { [tag]: _tag, ...rest } = found
    return { [tag]: name, ...variants[name]!(rest) } as never
  }
}
