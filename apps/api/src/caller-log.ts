import { admit, refund, type Admission, type CallerLog, type LimitKind } from "@airdesign/mcp"

import { withAddress } from "./account.js"
import type { Sql } from "./pool.js"

export async function lockedLog(client: Sql, email: string): Promise<CallerLog> {
  const found = await client.query<{ events: CallerLog["events"] }>(
    `insert into session.caller_log (email, events) values ($1, '[]')
     on conflict (email) do update set email = excluded.email
     returning events`,
    [email],
  )
  return { events: found.rows[0]?.events ?? [] }
}

export async function writeLog(client: Sql, email: string, log: CallerLog): Promise<void> {
  await client.query("update session.caller_log set events = $2 where email = $1", [email, JSON.stringify(log.events)])
}

export async function admitCaller(db: Sql, email: string, kind: LimitKind, now: number): Promise<Admission> {
  return withAddress(db, email, async (client) => {
    const admission = admit(await lockedLog(client, email), kind, now)
    if (admission.ok) await writeLog(client, email, admission.log)
    return admission
  })
}

export async function refundCaller(db: Sql, email: string, kind: LimitKind): Promise<void> {
  await withAddress(db, email, async (client) => {
    await writeLog(client, email, refund(await lockedLog(client, email), kind))
  })
}
