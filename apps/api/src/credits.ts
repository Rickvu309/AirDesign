import { resetCents, type Credits } from "@airdesign/catalog"
import { withAddress } from "./account.js"
import { readLedger, writeLedger, turnOver } from "./aira-ledger.js"
import type { Sql } from "./pool.js"

export async function readCredits(db: Sql, email: string): Promise<Credits> {
  const account = await db.query<{ cents: number; auto_reset: boolean }>(
    "select cents, auto_reset from session.credits where email=$1",
    [email],
  )
  const history = await db.query<{ id: string; at: Date; cents: -500 }>(
    "select id, at, cents from session.credit_history where email=$1 order by id desc limit 100",
    [email],
  )
  return {
    cents: account.rows[0]?.cents ?? 0,
    autoReset: account.rows[0]?.auto_reset ?? false,
    history: history.rows.map((row) => ({ id: row.id, at: row.at.toISOString(), cents: row.cents, kind: "reset" })),
  }
}

async function charge(db: Sql, email: string, now: number, once: string): Promise<boolean> {
  const paid = await db.query(
    "update session.credits set cents=cents-$2 where email=$1 and cents >= $2 returning email",
    [email, resetCents],
  )
  if (paid.rows.length === 0) return false
  await db.query("insert into session.credit_history(email,once,at,cents) values ($1,$2,$3,$4)", [
    email,
    once,
    new Date(now),
    -resetCents,
  ])
  return true
}

export async function autoResetCredits(db: Sql, email: string, now: number, once: string): Promise<boolean> {
  const opted = await db.query<{ auto_reset: boolean }>("select auto_reset from session.credits where email=$1", [
    email,
  ])
  return opted.rows[0]?.auto_reset === true && (await charge(db, email, now, once))
}

export async function resetCredits(db: Sql, email: string, now: number, once: string) {
  const request = `manual_${once}`
  return withAddress(db, email, async (client) => {
    const previous = await client.query("select 1 from session.credit_history where email=$1 and once=$2", [
      email,
      request,
    ])
    if (previous.rows.length > 0) return { ok: true as const, credits: await readCredits(client, email) }
    const stored = await readLedger(client, email, now)
    const ledger = turnOver(stored, now)
    if (ledger !== stored) await writeLedger(client, email, ledger)
    if (ledger.open !== null) return { ok: false as const, refusal: "open" as const }
    if (ledger.spent === 0) return { ok: false as const, refusal: "empty" as const }
    if (!(await charge(client, email, now, request))) return { ok: false as const, refusal: "credits" as const }
    await writeLedger(client, email, { ...ledger, spent: 0 })
    return { ok: true as const, credits: await readCredits(client, email) }
  })
}

export async function setAutoReset(db: Sql, email: string, enabled: boolean): Promise<Credits> {
  return withAddress(db, email, async (client) => {
    await client.query(
      `insert into session.credits(email,auto_reset) values ($1,$2)
      on conflict(email) do update set auto_reset=excluded.auto_reset`,
      [email, enabled],
    )
    return readCredits(client, email)
  })
}
