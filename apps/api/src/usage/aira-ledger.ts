import { allowance, usage, type Command, type Ledger } from "@airdesign/usage"
import type { Sql } from "../platform/pool.js"

const weekLength = 604_800_000
const nano = 1_000_000_000

export type WeekUsage = { readonly used: number; readonly allowed: number; readonly resets: string }
export type Stored = Ledger & { readonly monday: number }

export function weekStart(now: number): number {
  const day = new Date(now)
  const back = (day.getUTCDay() + 6) % 7
  return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - back)
}

export function weekUsage(ledger: Pick<Stored, "spent" | "monday">): WeekUsage {
  return {
    used: ledger.spent / nano,
    allowed: allowance / nano,
    resets: new Date(ledger.monday + weekLength).toISOString(),
  }
}

export async function readUsage(db: Sql, account: string, now: number): Promise<WeekUsage> {
  const found = await db.query<{ spent: string; monday: Date }>(
    "select spent, monday from session.aira_ledger where email = $1",
    [account],
  )
  const row = found.rows[0]
  const current = weekStart(now)
  if (row === undefined || row.monday.getTime() < current) return weekUsage({ spent: 0, monday: current })
  return weekUsage({ spent: Number(row.spent), monday: row.monday.getTime() })
}

export async function readLedger(db: Sql, account: string, now: number): Promise<Stored> {
  await db.query("insert into session.aira_ledger (email, monday) values ($1, $2) on conflict (email) do nothing", [
    account,
    new Date(weekStart(now)),
  ])
  const found = await db.query<{
    spent: string
    hold: string
    turn: string | null
    week: number
    outside: number
    monday: Date
  }>("select spent, hold, turn, week, outside, monday from session.aira_ledger where email = $1", [account])
  const row = found.rows[0]
  if (row === undefined) throw new Error("ledger")
  return {
    spent: Number(row.spent),
    open: row.turn === null ? null : { turn: row.turn, hold: Number(row.hold) },
    week: row.week,
    outside: row.outside,
    monday: row.monday.getTime(),
  }
}

export async function writeLedger(db: Sql, account: string, ledger: Stored): Promise<void> {
  await db.query(
    `update session.aira_ledger set spent = $2, hold = $3, turn = $4, week = $5, outside = $6, monday = $7
     where email = $1`,
    [
      account,
      ledger.spent,
      ledger.open?.hold ?? 0,
      ledger.open?.turn ?? null,
      ledger.week,
      ledger.outside,
      new Date(ledger.monday),
    ],
  )
}

export function applied(ledger: Stored, command: Command): { readonly accepted: boolean; readonly ledger: Stored } {
  const result = usage(ledger, command)
  return { accepted: result.accepted, ledger: { ...result.ledger, monday: ledger.monday } }
}

export function turnOver(ledger: Stored, now: number): Stored {
  const current = weekStart(now)
  if (current <= ledger.monday) return ledger
  const reset = applied(ledger, { command: "monday" })
  if (!reset.accepted) return ledger
  return { ...reset.ledger, monday: current }
}
