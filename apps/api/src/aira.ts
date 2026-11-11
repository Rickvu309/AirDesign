import { createHmac } from "node:crypto"

import { admit, emptyLog, type CallerLog } from "@airdesign/mcp"
import { allowance, usage, type Command, type Ledger } from "@airdesign/usage"

import { withAddress } from "./account.js"
import type { Sql } from "./pool.js"

export const airaModel = "claude-sonnet-5-5"
export const airaMaxTokens = 8192
export const airaTextCap = 8000
export const airaBodyCap = 65_536
export const staleTurn = 900_000

const framing = 64
const weekLength = 604_800_000
const nano = 1_000_000_000

export const instructions =
  "You are Aira, the AI agent inside AirDesign, where people make slide decks. You are an AI, not a person. Answer the person's message about their deck plainly and briefly. Say when a fact should be checked."

export const supportedCountries: ReadonlySet<string> = new Set(
  (
    "AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CO KM CG CD " +
    "CR CI HR CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID " +
    "IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA " +
    "MZ NA NR NP NL NZ NI NE NG MK NO OM PK PW PS PA PG PY PE PH PL PT QA RO RW KN LC VC WS SM ST SA SN RS SC SL SG " +
    "SK SI SO SB ZA KR SS ES LK SD SR SE CH TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VN ZM ZW " +
    "PR GU VI AS MP UM GP MQ RE GF YT PM NC PF WF BL MF TF GI BM KY VG AI MS TC FK SH IO PN GG JE IM GS GL FO AW CW " +
    "SX BQ CK NU TK CX CC NF HM SJ BV AX"
  ).split(" "),
)

export type ModelCall = {
  readonly model: string
  readonly max_tokens: number
  readonly system: string
  readonly messages: readonly { readonly role: "user"; readonly content: string }[]
  readonly metadata: { readonly user_id: string }
  readonly output_config: { readonly effort: "low" }
}

export type ModelOpen =
  | { readonly ok: true; readonly request: string | null; readonly events: AsyncIterable<unknown> }
  | {
      readonly ok: false
      readonly request: string | null
      readonly status: number
      readonly type: string
      readonly message: string
    }

export type Transport = (call: ModelCall, key: string) => Promise<ModelOpen>

export type AiraSettings = {
  readonly on: boolean
  readonly key: string | undefined
  readonly secret: string | undefined
  readonly transport: Transport
  readonly log?: (line: string) => void
}

export type AiraHost = {
  readonly settings: AiraSettings | undefined
  readonly db: Sql
  readonly logs: Map<string, CallerLog>
  readonly now: () => number
  readonly mint: () => string
}

export type Counts = {
  readonly input: number
  readonly output: number
  readonly write5m: number
  readonly write1h: number
  readonly read: number
}

export type WeekUsage = { readonly used: number; readonly allowed: number; readonly resets: string }

export type AiraAnswer = { readonly status: number; readonly body: unknown }

type Stored = Ledger & { readonly monday: number }

type Reserved =
  | { readonly ok: true; readonly ledger: Stored }
  | { readonly ok: false; readonly refusal: "open" | "allowance"; readonly ledger: Stored }

type Played =
  | { readonly kind: "settled"; readonly text: string; readonly counts: Counts }
  | { readonly kind: "released" }
  | { readonly kind: "dropped" }

const noUsage = { search: 0, searchOn: false, usOnly: false } as const

export function readTurn(raw: unknown): { readonly ok: true; readonly text: string } | { readonly ok: false } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false }
  const keys = Object.keys(raw)
  if (keys.length !== 1 || keys[0] !== "text") return { ok: false }
  const text: unknown = (raw as { text?: unknown }).text
  if (typeof text !== "string" || text.trim().length === 0 || text.length > airaTextCap) return { ok: false }
  return { ok: true, text }
}

export function accountId(secret: string, account: string): string {
  return createHmac("sha256", secret).update(account).digest("hex")
}

export function weekStart(now: number): number {
  const day = new Date(now)
  const back = (day.getUTCDay() + 6) % 7
  return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - back)
}

function inputCeiling(text: string): number {
  return Buffer.byteLength(instructions) + Buffer.byteLength(text) + framing
}

function weekUsage(ledger: Stored): WeekUsage {
  return {
    used: ledger.spent / nano,
    allowed: allowance / nano,
    resets: new Date(ledger.monday + weekLength).toISOString(),
  }
}

function refuse(status: number, refusal: string, extra: Record<string, unknown> = {}): AiraAnswer {
  return { status, body: { ok: false, refusal, ...extra } }
}

async function readLedger(db: Sql, account: string, now: number): Promise<Stored> {
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
    hold: Number(row.hold),
    turn: row.turn,
    week: row.week,
    outside: row.outside,
    monday: row.monday.getTime(),
  }
}

async function writeLedger(db: Sql, account: string, ledger: Stored): Promise<void> {
  await db.query(
    `update session.aira_ledger set spent = $2, hold = $3, turn = $4, week = $5, outside = $6, monday = $7
     where email = $1`,
    [account, ledger.spent, ledger.hold, ledger.turn, ledger.week, ledger.outside, new Date(ledger.monday)],
  )
}

function applied(ledger: Stored, command: Command): { readonly accepted: boolean; readonly ledger: Stored } {
  const result = usage(ledger, command)
  return { accepted: result.accepted, ledger: { ...result.ledger, monday: ledger.monday } }
}

function turnOver(ledger: Stored, now: number): Stored {
  const current = weekStart(now)
  if (current <= ledger.monday) return ledger
  const reset = applied(ledger, { command: "monday" })
  if (!reset.accepted) return ledger
  return { ...reset.ledger, monday: current }
}

async function closeTurn(
  db: Sql,
  account: string,
  ledger: Stored,
  id: string,
  outcome: "settled" | "dropped",
  counts: Counts,
  now: number,
): Promise<Stored> {
  const result = applied(ledger, { command: "settle", id, ...counts, ...noUsage })
  if (!result.accepted) return ledger
  await writeLedger(db, account, result.ledger)
  await db.query(
    `update session.aira_turn set outcome = $2, charged = $3, ended = $4 where id = $1 and outcome = 'open'`,
    [id, outcome, result.ledger.spent - ledger.spent, new Date(now)],
  )
  return result.ledger
}

async function dropStale(db: Sql, account: string, ledger: Stored, now: number): Promise<Stored> {
  if (ledger.turn === null) return ledger
  const found = await db.query<{ input: number; started: Date }>(
    "select input, started from session.aira_turn where id = $1 and outcome = 'open'",
    [ledger.turn],
  )
  const row = found.rows[0]
  if (row === undefined || now - row.started.getTime() < staleTurn) return ledger
  return closeTurn(db, account, ledger, ledger.turn, "dropped", heldCounts(row.input), now)
}

function heldCounts(input: number): Counts {
  return { input, output: airaMaxTokens, write5m: 0, write1h: 0, read: 0 }
}

async function reserveTurn(db: Sql, account: string, id: string, input: number, now: number): Promise<Reserved> {
  return withAddress(db, account, async (client) => {
    const stored = await readLedger(client, account, now)
    const ledger = turnOver(await dropStale(client, account, stored, now), now)
    const result = applied(ledger, {
      command: "reserve",
      id,
      input,
      maxTokens: airaMaxTokens,
      coldPrefix: 0,
      ...noUsage,
    })
    if (!result.accepted) {
      if (ledger !== stored) await writeLedger(client, account, ledger)
      return { ok: false, refusal: ledger.turn === null ? "allowance" : "open", ledger }
    }
    await writeLedger(client, account, result.ledger)
    await client.query(
      `insert into session.aira_turn (id, email, outcome, input, ceiling, started)
       values ($1, $2, 'open', $3, $4, $5)`,
      [id, account, input, result.ledger.hold, new Date(now)],
    )
    return { ok: true, ledger: result.ledger }
  })
}

export async function settleTurn(
  db: Sql,
  account: string,
  id: string,
  outcome: "settled" | "dropped",
  counts: Counts,
  now: number,
): Promise<Stored> {
  return withAddress(db, account, async (client) => {
    const ledger = await readLedger(client, account, now)
    return closeTurn(client, account, ledger, id, outcome, counts, now)
  })
}

async function releaseTurn(db: Sql, account: string, id: string, now: number): Promise<Stored> {
  return withAddress(db, account, async (client) => {
    const ledger = await readLedger(client, account, now)
    const result = applied(ledger, { command: "release", id })
    if (!result.accepted) return ledger
    await writeLedger(client, account, result.ledger)
    await client.query(
      "update session.aira_turn set outcome = 'released', charged = 0, ended = $2 where id = $1 and outcome = 'open'",
      [id, new Date(now)],
    )
    return result.ledger
  })
}

async function noteRequest(db: Sql, id: string, request: string | null): Promise<void> {
  if (request === null) return
  await db.query("update session.aira_turn set request = $2 where id = $1", [id, request])
}

function fieldOf(value: unknown, name: string): unknown {
  if (typeof value !== "object" || value === null) return undefined
  return (value as Record<string, unknown>)[name]
}

function countOf(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

export function unavailable(status: number, type: string, message: string): boolean {
  if (status === 429 || status === 529) return true
  if (type === "rate_limit_error" || type === "overloaded_error") return true
  return status === 400 && /usage limits/i.test(message)
}

async function play(events: AsyncIterable<unknown>): Promise<Played> {
  let text = ""
  let started: unknown
  let final: unknown
  let begun = false
  try {
    for await (const event of events) {
      const type = fieldOf(event, "type")
      if (type === "message_start") {
        begun = true
        started = fieldOf(fieldOf(event, "message"), "usage")
      } else if (type === "content_block_delta") {
        const delta = fieldOf(event, "delta")
        const piece = fieldOf(delta, "text")
        if (fieldOf(delta, "type") === "text_delta" && typeof piece === "string") text += piece
      } else if (type === "message_delta") {
        final = fieldOf(event, "usage")
      } else if (type === "error") {
        const error = fieldOf(event, "error")
        const kind = fieldOf(error, "type")
        const message = fieldOf(error, "message")
        if (
          !begun &&
          final === undefined &&
          unavailable(0, typeof kind === "string" ? kind : "", typeof message === "string" ? message : "")
        ) {
          return { kind: "released" }
        }
        break
      }
    }
  } catch {
    return { kind: "dropped" }
  }
  if (final === undefined) return { kind: "dropped" }
  const pick = (name: string): number => countOf(fieldOf(final, name)) ?? countOf(fieldOf(started, name)) ?? 0
  return {
    kind: "settled",
    text,
    counts: {
      input: pick("input_tokens"),
      output: pick("output_tokens"),
      write5m: pick("cache_creation_input_tokens"),
      write1h: 0,
      read: pick("cache_read_input_tokens"),
    },
  }
}

function writeLine(line: string): void {
  process.stdout.write(`${line}\n`)
}

export async function airaTurn(
  host: AiraHost,
  account: string,
  country: string | string[] | undefined,
  raw: unknown,
): Promise<AiraAnswer> {
  const settings = host.settings
  if (settings === undefined || !settings.on || settings.key === undefined || settings.secret === undefined) {
    return refuse(403, "off")
  }
  if (typeof country !== "string" || !supportedCountries.has(country.toUpperCase())) return refuse(403, "country")
  const parsed = readTurn(raw)
  if (!parsed.ok) return refuse(400, "body")
  const now = host.now()
  const admission = admit(host.logs.get(account) ?? emptyLog(), "turn", now)
  if (!admission.ok) return refuse(429, "rate", { text: admission.text })
  const id = host.mint()
  const input = inputCeiling(parsed.text)
  const reserved = await reserveTurn(host.db, account, id, input, now)
  if (!reserved.ok)
    return refuse(reserved.refusal === "open" ? 409 : 402, reserved.refusal, {
      usage: weekUsage(reserved.ledger),
    })
  host.logs.set(account, admission.log)
  const user = accountId(settings.secret, account)
  const call: ModelCall = {
    model: airaModel,
    max_tokens: airaMaxTokens,
    system: instructions,
    messages: [{ role: "user", content: parsed.text }],
    metadata: { user_id: user },
    output_config: { effort: "low" },
  }
  let opened: ModelOpen
  try {
    opened = await settings.transport(call, settings.key)
  } catch {
    opened = { ok: false, request: null, status: 0, type: "api_error", message: "" }
  }
  await noteRequest(host.db, id, opened.request)
  const played: Played = opened.ok ? await play(opened.events) : { kind: "released" }
  const ended = host.now()
  let ledger: Stored
  if (played.kind === "settled") ledger = await settleTurn(host.db, account, id, "settled", played.counts, ended)
  else if (played.kind === "dropped")
    ledger = await settleTurn(host.db, account, id, "dropped", heldCounts(input), ended)
  else ledger = await releaseTurn(host.db, account, id, ended)
  ;(settings.log ?? writeLine)(
    `aira turn ${id} account ${user} request ${opened.request ?? "none"} outcome ${played.kind}`,
  )
  if (played.kind === "settled") return { status: 200, body: { ok: true, text: played.text, usage: weekUsage(ledger) } }
  if (played.kind === "dropped") return refuse(200, "dropped", { usage: weekUsage(ledger) })
  return refuse(200, "unavailable", { usage: weekUsage(ledger) })
}
