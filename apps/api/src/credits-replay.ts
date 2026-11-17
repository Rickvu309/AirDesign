import { resetCents } from "@airdesign/catalog"
import { resetCredits } from "./credits.js"
import { withAddress } from "./account.js"
import { applied, readLedger, writeLedger, turnOver } from "./aira-ledger.js"
import type { Sql } from "./pool.js"
import type { Graph, SpecState } from "./spec-graph.js"
import { same } from "./spec-graph.js"

function num(source: SpecState, field: string): number {
  const value = source[field]
  if (typeof value !== "number") throw new Error(`${field} is not a number`)
  return value
}

function flag(source: SpecState, field: string): boolean {
  const value = source[field]
  if (typeof value !== "boolean") throw new Error(`${field} is not a boolean`)
  return value
}

const firstMonday = Date.UTC(2026, 10, 9)
const weekLength = 604_800_000
const half = 1_000_000_000

async function seed(db: Sql, email: string, source: SpecState) {
  await db.query("insert into session.account(email) values ($1)", [email])
  await db.query("insert into session.credits(email,cents) values ($1,$2)", [email, num(source, "cents")])
  await db.query(
    `insert into session.aira_ledger(email,monday,spent,turn,hold,week)
    values ($1,$2,$3,$4,$5,$6)`,
    [
      email,
      new Date(firstMonday + num(source, "monday") * weekLength),
      num(source, "spent"),
      flag(source, "open") ? "a" : null,
      flag(source, "open") ? half : 0,
      num(source, "monday"),
    ],
  )
  for (const [field, once] of [
    ["onceA", "manual_a"],
    ["onceB", "manual_b"],
  ] as const) {
    if (flag(source, field))
      await db.query("insert into session.credit_history(email,once,at,cents) values($1,$2,$3,$4)", [
        email,
        once,
        new Date(firstMonday),
        -resetCents,
      ])
  }
}

async function picture(db: Sql, email: string) {
  const result = await db.query<{
    cents: number
    spent: string
    turn: string | null
    monday: Date
    once_a: boolean
    once_b: boolean
  }>(
    `select c.cents,l.spent,l.turn,l.monday,
    exists(select 1 from session.credit_history where email=$1 and once='manual_a') as once_a,
    exists(select 1 from session.credit_history where email=$1 and once='manual_b') as once_b
    from session.credits c join session.aira_ledger l using(email) where c.email=$1`,
    [email],
  )
  const row = result.rows[0]
  if (row === undefined) throw new Error("missing replay account")
  return {
    cents: row.cents,
    spent: Number(row.spent),
    open: row.turn !== null,
    monday: (row.monday.getTime() - firstMonday) / weekLength,
    onceA: row.once_a,
    onceB: row.once_b,
  }
}

async function drive(db: Sql, email: string, source: SpecState, action: string) {
  const now = firstMonday + num(source, "monday") * weekLength
  if (action === "ResetA" || action === "ResetB") {
    await resetCredits(db, email, now, action === "ResetA" ? "a" : "b")
    return
  }
  await withAddress(db, email, async (client) => {
    const ledger = await readLedger(client, email, now)
    if (action === "Monday") {
      await writeLedger(client, email, turnOver(ledger, firstMonday + weekLength))
      return
    }
    if (action === "Reserve") {
      const result = applied(ledger, {
        command: "reserve",
        id: "a",
        input: 0,
        maxTokens: 100_000,
        coldPrefix: 0,
        search: 0,
        searchOn: false,
        usOnly: false,
      })
      await writeLedger(client, email, result.ledger)
      return
    }
    if (action === "Finish") {
      const result = applied(ledger, {
        command: "settle",
        id: "a",
        input: 0,
        output: 100_000,
        write5m: 0,
        write1h: 0,
        read: 0,
        search: 0,
        searchOn: false,
        usOnly: false,
      })
      await writeLedger(client, email, result.ledger)
      return
    }
    throw new Error(`unconnected credit action ${action}`)
  })
}

export async function replayCredits(graph: Graph, db: Sql) {
  const failures: string[] = []
  const actions = new Set<string>()
  for (const [index, edge] of graph.edges.entries()) {
    const source = graph.states.get(edge.from)
    const target = graph.states.get(edge.to)
    if (source === undefined || target === undefined) throw new Error("missing credit state")
    const email = `credits-replay-${index}@example.com`
    await seed(db, email, source)
    await drive(db, email, source, edge.action)
    const actual = await picture(db, email)
    if (!same(actual, target))
      failures.push(
        `${JSON.stringify(source)} - ${edge.action} -> ${JSON.stringify(target)}; actual ${JSON.stringify(actual)}`,
      )
    const count = await db.query<{ count: number }>(
      "select count(*)::int as count from session.credit_history where email=$1",
      [email],
    )
    if (count.rows[0]?.count !== Number(flag(target, "onceA")) + Number(flag(target, "onceB")))
      failures.push(`${edge.action} duplicated credit history`)
    actions.add(edge.action)
  }
  return { failures, actions: [...actions].sort(), edges: graph.edges.length }
}
