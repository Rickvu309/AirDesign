import type { Sql } from "./pool.js"

export type Held = { readonly reached: Promise<void>; readonly release: () => void }

export type HeldQueries = {
  readonly db: Sql
  readonly hold: (match: string) => Held
  readonly times: (match: string) => number
}

type Waiting = { readonly match: string; readonly arrive: () => void; readonly go: Promise<void> }

export function heldQueries(target: Sql): HeldQueries {
  const waiting: Waiting[] = []
  const queried: string[] = []
  const hold = (match: string): Held => {
    let arrive = () => undefined as void
    let release = () => undefined as void
    const reached = new Promise<void>((resolve) => {
      arrive = resolve
    })
    const go = new Promise<void>((resolve) => {
      release = resolve
    })
    waiting.push({ match, arrive, go })
    return { reached, release }
  }
  const times = (match: string): number => queried.filter((text) => text.includes(match)).length
  const db = new Proxy(target, {
    get(inner, key) {
      const member = Reflect.get(inner, key) as unknown
      if (typeof member !== "function") return member
      if (key !== "query") return member.bind(inner)
      const query = member as (...args: unknown[]) => Promise<unknown>
      return async (...args: unknown[]) => {
        const text = typeof args[0] === "string" ? args[0] : ""
        queried.push(text)
        const index = waiting.findIndex((found) => text.includes(found.match))
        const found = waiting[index]
        if (found !== undefined) {
          waiting.splice(index, 1)
          found.arrive()
          await found.go
        }
        return query.apply(inner, args)
      }
    },
  }) as Sql
  return { db, hold, times }
}
