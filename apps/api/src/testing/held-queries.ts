import type { Sql } from "../platform/pool.js"

export type Held = { readonly reached: Promise<void>; readonly release: () => void; readonly answered: Promise<void> }

export type HeldQueries = {
  readonly db: Sql
  readonly hold: (match: string) => Held
  readonly times: (match: string) => number
}

type Waiting = {
  readonly match: string
  readonly arrive: () => void
  readonly go: Promise<void>
  readonly answer: () => void
}

export function heldQueries(target: Sql): HeldQueries {
  const waiting: Waiting[] = []
  const queried: string[] = []
  const hold = (match: string): Held => {
    let arrive = () => undefined as void
    let release = () => undefined as void
    let answer = () => undefined as void
    const answered = new Promise<void>((resolve) => {
      answer = resolve
    })
    const reached = new Promise<void>((resolve) => {
      arrive = resolve
    })
    const go = new Promise<void>((resolve) => {
      release = resolve
    })
    waiting.push({ match, arrive, go, answer })
    return { reached, release, answered }
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
        if (found === undefined) return query.apply(inner, args)
        waiting.splice(index, 1)
        found.arrive()
        await found.go
        try {
          return await query.apply(inner, args)
        } finally {
          found.answer()
        }
      }
    },
  }) as Sql
  return { db, hold, times }
}
