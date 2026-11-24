import { bytesOf } from "./limits.js"

export type Reader<T> = (raw: unknown) => T
export type FieldFault = "missing" | "unknown" | "form" | "needs"

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

export const reject = (kind: "shape" | "limit" = "shape"): never => {
  throw new Reject(kind)
}

const wrong = (form: string): never => {
  throw new Reject("shape", undefined, "form", form)
}

export function rejected(thrown: unknown): "shape" | "limit" {
  if (!(thrown instanceof Reject)) throw thrown
  return thrown.kind
}

export function detailOf(thrown: unknown): {
  readonly refused: "shape" | "limit"
  readonly field?: string
  readonly fault?: FieldFault
  readonly form?: string
} {
  if (!(thrown instanceof Reject)) throw thrown
  return {
    refused: thrown.kind,
    ...(thrown.field === undefined ? {} : { field: thrown.field }),
    ...(thrown.fault === undefined ? {} : { fault: thrown.fault }),
    ...(thrown.form === undefined ? {} : { form: thrown.form }),
  }
}

export function formed<T>(read: (raw: unknown) => T | undefined, form: string): Reader<T> {
  const reader: Reader<T> = (raw) => {
    const value = read(raw)
    if (value === undefined) throw new Reject("shape", undefined, "form", form)
    return value
  }
  rememberForm(reader, form)
  return reader
}

export function accepting<T>(form: string, read: Reader<T>): Reader<T> {
  const reader: Reader<T> = (raw) => {
    try {
      return read(raw)
    } catch (thrown) {
      if (thrown instanceof Reject && thrown.field === undefined) {
        thrown.fault = "form"
        thrown.form = form
      }
      throw thrown
    }
  }
  rememberForm(reader, form)
  return reader
}

export function agentColor(pattern: RegExp, max: number, form: string): Reader<string> {
  const hex = /^#[0-9a-fA-F]{6}$/
  const read: Reader<string> = (raw) => {
    if (typeof raw === "string" && hex.test(raw)) return raw.toLowerCase()
    if (typeof raw === "string" && raw.length <= max && pattern.test(raw)) return raw
    return wrong(form)
  }
  rememberForm(read, form)
  return read
}

export function mismatch(field: string, form: string): never {
  throw new Reject("shape", field, "form", form)
}

export function wrongForm(form: string): never {
  return wrong(form)
}

export const forms = {
  node: "1 to 16 of a-z or 0-9, a colon, then 1 to 12 digits.",
  after: "A node id, or null.",
  color: "A theme colour, lighter or darker by a percent, or #rrggbb.",
  font: "A letter or digit, then up to 99 letters, digits or spaces.",
  icon: "Letters, digits and dashes, or group/name.",
  target: "A node id, <slide>.title, *.title, or <chart>#<series>:<category>.",
  hex: "#rrggbb.",
  stroke: "A theme colour, lighter or darker by a percent, #rrggbb, or none.",
  fill: "A colour, none, {image} or {gradient}.",
  series: "One value per category.",
  points: "At most one colour for each category's place.",
  pieColor: "A pie colours each slice; set the slice with points or #series:category, not the series.",
  text: "A non-empty string.",
} as const

const held = new WeakMap<Reader<unknown>, string>()
const genericForm = new Set(["An object.", "A list."])
const requiredOf = new WeakMap<Reader<unknown>, readonly string[]>()

export function rememberForm(read: Reader<unknown>, form: string): void {
  held.set(read, form)
}

export function formOf(read: Reader<unknown>): string | undefined {
  return held.get(read)
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
      thrown.field = thrown.field === undefined ? field : `${field}.${thrown.field}`
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
rememberForm(boolean, "true or false.")

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

export const unsafe =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/

export const words = (maxBytes: number, minLength = 0): Reader<string> => {
  const empty = minLength > 0 ? "A non-empty string." : "A string."
  const read: Reader<string> = (raw) => {
    if (typeof raw !== "string" || raw.length < minLength) return wrong(empty)
    if (unsafe.test(raw)) return wrong("A string with no control characters or lone surrogates.")
    return bytesOf(raw) > maxBytes ? reject("limit") : raw
  }
  rememberForm(read, empty)
  return read
}

export const matching = (pattern: RegExp, maxLength: number, form?: string): Reader<string> => {
  const read: Reader<string> = (raw) =>
    typeof raw === "string" && raw.length <= maxLength && pattern.test(raw)
      ? raw
      : form === undefined
        ? reject()
        : wrong(form)
  if (form !== undefined) rememberForm(read, form)
  return read
}

export const literal = <const V extends string>(values: readonly V[]): Reader<V> => {
  const form = `One of ${values.join(", ")}.`
  const read: Reader<V> = (raw) =>
    typeof raw === "string" && (values as readonly string[]).includes(raw) ? (raw as V) : wrong(form)
  rememberForm(read, form)
  return read
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

export const pair = <T>(item: Reader<T>): Reader<readonly [T, T]> => {
  const read: Reader<readonly [T, T]> = (raw) => {
    if (!Array.isArray(raw) || raw.length !== 2) return wrong("Two values.")
    return [naming("0", () => item(raw[0])), naming("1", () => item(raw[1]))]
  }
  rememberForm(read, "Two values.")
  return read
}

export const quad = <T>(item: Reader<T>): Reader<readonly [T, T, T, T]> => {
  const read: Reader<readonly [T, T, T, T]> = (raw) => {
    if (!Array.isArray(raw) || raw.length !== 4) return wrong("Four values.")
    return [
      naming("0", () => item(raw[0])),
      naming("1", () => item(raw[1])),
      naming("2", () => item(raw[2])),
      naming("3", () => item(raw[3])),
    ]
  }
  rememberForm(read, "Four values.")
  return read
}

function branchScore(raw: Record<string, unknown>, reader: Reader<unknown>, thrown: Reject): number {
  const keys = requiredOf.get(reader)
  const present = keys !== undefined && keys.some((key) => Object.hasOwn(raw, key))
  const nested = thrown.field !== undefined && thrown.field.includes(".")
  const head = thrown.field?.split(".")[0]
  const valued = thrown.fault !== "unknown" && head !== undefined && Object.hasOwn(raw, head)
  if (!present && !nested && !valued) return 0
  const depth = thrown.field === undefined ? 1 : thrown.field.split(".").length
  return depth + (nested ? 20 : 0) + (valued ? 10 : 0) + (present ? 5 : 0)
}

export function oneOf<T>(...readers: readonly Reader<T>[]): Reader<T> {
  function read(raw: unknown): T {
    let kind: "shape" | "limit" = "shape"
    let best: { score: number; thrown: Reject } | undefined
    for (const reader of readers) {
      try {
        return reader(raw)
      } catch (thrown) {
        if (!(thrown instanceof Reject)) throw thrown
        if (thrown.kind === "limit") kind = "limit"
        const found = recordOf(raw)
        if (found === undefined) continue
        const score = branchScore(found, reader, thrown)
        if (best === undefined || score > best.score) best = { score, thrown }
      }
    }
    if (best !== undefined && best.score > 0) throw best.thrown
    const form = formOf(read)
    if (form !== undefined && kind === "shape") throw new Reject("shape", undefined, "form", form)
    return reject(kind)
  }
  return read
}

export function union<T>(form: string, readers: readonly Reader<T>[]): Reader<T> {
  const read = oneOf(...readers)
  rememberForm(read, form)
  return read
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
  const read = (raw: unknown) => {
    const found = plain(raw)
    for (const key of Object.keys(found)) if (!allowed.has(key)) throw new Reject("shape", key, "unknown", accepted)
    const built: Record<string, unknown> = {}
    for (const [key, reader] of Object.entries(required)) {
      if (!Object.hasOwn(found, key)) throw new Reject("shape", key, "missing", formOf(reader))
      built[key] = naming(key, () => reader(found[key]))
    }
    for (const [key, reader] of Object.entries(optional ?? {}))
      if (Object.hasOwn(found, key)) built[key] = naming(key, () => reader(found[key]))
    return built as Required<R> & Optional<O>
  }
  requiredOf.set(read, Object.keys(required))
  return read
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
