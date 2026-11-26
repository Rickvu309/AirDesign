const gone: unique symbol = Symbol("gone")
type Held<V> = V | typeof gone

const flattenAt = 12

class LayeredMap<K, V> implements Map<K, V> {
  readonly #below: ReadonlyMap<K, V>
  readonly #own = new Map<K, Held<V>>()
  readonly depth: number
  #size: number

  constructor(below: ReadonlyMap<K, V>, depth: number) {
    this.#below = below
    this.depth = depth
    this.#size = below.size
  }

  get size(): number {
    return this.#size
  }

  get [Symbol.toStringTag](): string {
    return "Map"
  }

  has(key: K): boolean {
    const held = this.#own.get(key)
    if (held !== undefined || this.#own.has(key)) return held !== gone
    return this.#below.has(key)
  }

  get(key: K): V | undefined {
    if (this.#own.has(key)) {
      const held = this.#own.get(key)
      return held === gone ? undefined : held
    }
    return this.#below.get(key)
  }

  set(key: K, value: V): this {
    if (!this.has(key)) this.#size += 1
    this.#own.set(key, value)
    return this
  }

  delete(key: K): boolean {
    if (!this.has(key)) return false
    this.#own.set(key, gone)
    this.#size -= 1
    return true
  }

  clear(): void {
    for (const key of this.keys()) this.delete(key)
  }

  *entries(): MapIterator<[K, V]> {
    for (const [key, value] of this.#below) {
      if (!this.#own.has(key)) yield [key, value]
      else {
        const held = this.#own.get(key)
        if (held !== gone) yield [key, held as V]
      }
    }
    for (const [key, held] of this.#own) if (held !== gone && !this.#below.has(key)) yield [key, held]
  }

  *keys(): MapIterator<K> {
    for (const [key] of this.entries()) yield key
  }

  *values(): MapIterator<V> {
    for (const [, value] of this.entries()) yield value
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries()
  }

  forEach(each: (value: V, key: K, map: Map<K, V>) => void, self?: unknown): void {
    for (const [key, value] of this.entries()) each.call(self, value, key, this)
  }
}

export function layeredOver<K, V>(below: ReadonlyMap<K, V>): Map<K, V> {
  const depth = below instanceof LayeredMap ? below.depth : 0
  return depth >= flattenAt ? new LayeredMap(new Map(below), 1) : new LayeredMap(below, depth + 1)
}
