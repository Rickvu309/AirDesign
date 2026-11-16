import type { DeckListen } from "./listen.js"
import type { Sql } from "./pool.js"

export const closeBound = 5_000

export type Followed = {
  readonly id: string
  readonly signal: AbortSignal
  readonly stopped: () => Promise<boolean>
  readonly done: () => Promise<void>
}

type Shared = { readonly db: Sql; readonly listen: DeckListen }

type Running = { readonly stop: AbortController; readonly closed: Promise<void> }

const followSql = `
with stale as (delete from session.aira_ask where email = $1 and started < now() - interval '15 minutes')
insert into session.aira_ask (email, ask) values ($1, $2)
on conflict (email, ask) do update set id = default, started = now(), followed = true
returning id, stopped is not null as stopped`

const stoppedSql = "select stopped is not null as stopped from session.aira_ask where id = $1"

const liveSql = "select exists (select 1 from session.aira_ask where id = $1 and stopped is null) as live"

const stopSql = `
insert into session.aira_ask (email, ask, stopped, followed) values ($1, $2, now(), false)
on conflict (email, ask) do update set stopped = coalesce(aira_ask.stopped, now())
where aira_ask.started >= now() - interval '15 minutes'
returning id, followed`

const openStopSql = `
select id from session.aira_ask
where email = $1 and id <> $2 and stopped is not null and followed and started >= now() - interval '15 minutes'
limit 1`

export class Closing {
  private readonly stopping = new Map<string, Promise<void>>()
  private readonly asks = new Map<string, Running>()
  private readonly shared: Shared
  private readonly bound: number

  constructor(shared: Shared, bound: number = closeBound) {
    this.shared = shared
    this.bound = bound
  }

  async follow(account: string, ask: string | undefined, left: AbortSignal): Promise<Followed> {
    const found = await this.shared.db.query<{ id: string; stopped: boolean }>(followSql, [account, ask ?? null])
    const row = found.rows[0]
    if (row === undefined) throw new Error("aira ask")
    const { id } = row
    const stop = new AbortController()
    if (row.stopped) stop.abort()
    const finished = new AbortController()
    const signal = AbortSignal.any([left, stop.signal])
    let close = (): void => undefined
    const closed = new Promise<void>((resolve) => {
      close = resolve
    })
    const mark = (): void => {
      this.stopping.set(account, closed)
      void this.mark(id)
    }
    if (signal.aborted) mark()
    else signal.addEventListener("abort", mark, { once: true })
    const named = ask === undefined ? undefined : `${account}\n${ask}`
    if (named !== undefined) this.asks.set(named, { stop, closed })
    void this.watch(id, stop, AbortSignal.any([signal, finished.signal]))
    return {
      id,
      signal,
      stopped: async () => {
        if (!signal.aborted) {
          const found = await this.shared.db.query<{ live: boolean }>(liveSql, [id]).catch(() => undefined)
          if (found?.rows[0]?.live !== true) stop.abort()
        }
        return signal.aborted
      },
      done: async () => {
        signal.removeEventListener("abort", mark)
        finished.abort()
        try {
          await this.forget(id)
        } finally {
          if (this.stopping.get(account) === closed) this.stopping.delete(account)
          if (named !== undefined && this.asks.get(named)?.closed === closed) this.asks.delete(named)
          close()
        }
      },
    }
  }

  async stop(account: string, ask: string): Promise<void> {
    const running = this.asks.get(`${account}\n${ask}`)
    if (running !== undefined) {
      running.stop.abort()
      await this.within(running.closed)
      return
    }
    const { db } = this.shared
    const marked = await db.query<{ id: string; followed: boolean }>(stopSql, [account, ask])
    const row = marked.rows[0]
    if (row?.followed !== true) return
    await db.query("select pg_notify('aira', '')")
    await this.settled(async () => {
      const left = await db.query("select 1 from session.aira_ask where id = $1", [row.id])
      return left.rows.length > 0
    })
  }

  async closed(account: string, own: Followed): Promise<void> {
    const turn = this.stopping.get(account)
    if (turn !== undefined) {
      await this.within(turn)
      return
    }
    await this.settled(async () => {
      const found = await this.shared.db.query(openStopSql, [account, own.id])
      return found.rows.length > 0
    })
  }

  private async mark(id: string): Promise<void> {
    await this.shared.db
      .query("update session.aira_ask set stopped = coalesce(stopped, now()) where id = $1", [id])
      .catch(() => undefined)
  }

  private async forget(id: string): Promise<void> {
    const { db } = this.shared
    const gone = await db.query<{ stopped: boolean }>(
      "delete from session.aira_ask where id = $1 returning stopped is not null as stopped",
      [id],
    )
    if (gone.rows[0]?.stopped === true) await db.query("select pg_notify('aira', '')")
  }

  private async watch(id: string, stop: AbortController, ended: AbortSignal): Promise<void> {
    const { db, listen } = this.shared
    try {
      while (!ended.aborted) {
        const woken = listen.wait(ended, "aira")
        await listen.ready()
        const found = await db.query<{ stopped: boolean }>(stoppedSql, [id])
        if (found.rows[0]?.stopped === true) {
          stop.abort()
          return
        }
        await woken
      }
    } catch {
      return
    }
  }

  private async settled(open: () => Promise<boolean>): Promise<void> {
    const { listen } = this.shared
    const late = AbortSignal.timeout(this.bound)
    try {
      while (!late.aborted) {
        const woken = listen.wait(late, "aira")
        await listen.ready()
        if (!(await open())) return
        await woken
      }
    } catch {
      return
    }
  }

  private async within(turn: Promise<void>): Promise<void> {
    let timer: NodeJS.Timeout | undefined
    const late = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, this.bound)
    })
    await Promise.race([turn, late])
    clearTimeout(timer)
  }
}
