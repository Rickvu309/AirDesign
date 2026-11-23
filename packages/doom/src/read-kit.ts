import { bytesOf } from "./limits.js"

export type Reader<T> = (raw: unknown) => T

class Reject {
  readonly kind: "shape" | "limit"
  constructor(kind: "shape" | "limit") {
    this.kind = kind
  }
}

export const reject = (kind: "shape" | "limit" = "shape"): never => {
  throw new Reject(kind)
}

export function rejected(thrown: unknown): "shape" | "limit" {
  if (thrown instanceof Reject) return thrown.kind
  throw thrown
}

const plain = (raw: unknown): Record<string, unknown> =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : reject()

export const boolean: Reader<boolean> = (raw) => (typeof raw === "boolean" ? raw : reject())

export const finite =
  (min: number, max: number): Reader<number> =>
  (raw) =>
    typeof raw === "number" && Number.isFinite(raw) && raw >= min && raw <= max ? raw : reject()

export const integer =
  (min: number, max: number): Reader<number> =>
  (raw) =>
    typeof raw === "number" && Number.isInteger(raw) && raw >= min && raw <= max ? raw : reject()

export const words =
  (maxBytes: number, minLength = 0): Reader<string> =>
  (raw) => {
    if (typeof raw !== "string" || raw.length < minLength) return reject()
    return bytesOf(raw) > maxBytes ? reject("limit") : raw
  }

export const matching =
  (pattern: RegExp, maxLength: number): Reader<string> =>
  (raw) =>
    typeof raw === "string" && raw.length <= maxLength && pattern.test(raw) ? raw : reject()

export const literal =
  <const V extends string>(values: readonly V[]): Reader<V> =>
  (raw) =>
    typeof raw === "string" && (values as readonly string[]).includes(raw) ? (raw as V) : reject()

export const list =
  <T>(item: Reader<T>, max: number, min = 0): Reader<readonly T[]> =>
  (raw) => {
    if (!Array.isArray(raw) || raw.length < min) return reject()
    if (raw.length > max) return reject("limit")
    return raw.map(item)
  }

export const pair =
  <T>(item: Reader<T>): Reader<readonly [T, T]> =>
  (raw) =>
    Array.isArray(raw) && raw.length === 2 ? [item(raw[0]), item(raw[1])] : reject()

export const quad =
  <T>(item: Reader<T>): Reader<readonly [T, T, T, T]> =>
  (raw) =>
    Array.isArray(raw) && raw.length === 4 ? [item(raw[0]), item(raw[1]), item(raw[2]), item(raw[3])] : reject()

export const oneOf =
  <T>(...readers: readonly Reader<T>[]): Reader<T> =>
  (raw) => {
    let kind: "shape" | "limit" = "shape"
    for (const reader of readers) {
      try {
        return reader(raw)
      } catch (thrown) {
        if (rejected(thrown) === "limit") kind = "limit"
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
  return (raw) => {
    const found = plain(raw)
    for (const key of Object.keys(found)) if (!allowed.has(key)) reject()
    const read: Record<string, unknown> = {}
    for (const [key, reader] of Object.entries(required)) {
      if (!Object.hasOwn(found, key)) reject()
      read[key] = reader(found[key])
    }
    for (const [key, reader] of Object.entries(optional ?? {}))
      if (Object.hasOwn(found, key)) read[key] = reader(found[key])
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
  return (raw) => {
    const found = plain(raw)
    const name = found[tag]
    if (typeof name !== "string" || !Object.hasOwn(variants, name)) return reject()
    const { [tag]: _tag, ...rest } = found
    return { [tag]: name, ...variants[name]!(rest) } as never
  }
}
