export type Shelf = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">

export function pageShelf(): Shelf | undefined {
  try {
    return "window" in globalThis ? globalThis.localStorage : undefined
  } catch {
    return undefined
  }
}
