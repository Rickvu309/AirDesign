import { createHmac } from "node:crypto"

import {
  airaScreenshotBytes,
  airaScreenshotCap,
  airaTools,
  screenshotTokenCeiling,
  screenshotsIn,
  readTurn,
  type ModelMessage,
  type ModelTool,
  type ReplyBlock,
} from "@airdesign/catalog"
import { bytesOf } from "@airdesign/doom"
import { instructions } from "@airdesign/agent"
import { usage } from "@airdesign/usage"
import {
  readLedger,
  writeLedger,
  applied,
  turnOver,
  weekUsage,
  type Stored,
  type WeekUsage,
} from "../usage/aira-ledger.js"
import { autoResetCredits } from "../usage/credits.js"

import { withAddress } from "../account/account.js"
import type { Closing, Followed } from "./aira-closing.js"
import { admit } from "../account/admit.js"
import { lockedLog, writeLog } from "../account/caller-log.js"
import { play, type AiraEvent, type Counts, type Played, type Reported } from "./aira-stream.js"
import type { Sql } from "../platform/pool.js"

export const airaModel = "claude-sonnet-5-5"
export const airaEfforts = ["low", "medium", "high", "xhigh", "max"] as const
export type AiraEffort = (typeof airaEfforts)[number]
export const airaEffort: AiraEffort = "low"
export const airaMaxTokens = 8192
export const airaBodyCap = 262_144
export const airaTurnCap = airaBodyCap + airaScreenshotBytes + airaScreenshotCap * 128
export const staleTurn = 900_000

const framing = 64

const airaRole =
  'You are Aira, the AI agent inside AirDesign. The person watches the deck change as you edit it. Answer plainly and briefly. Say when a fact should be checked. Give each execute call a summary, the few words the person sees for that step, such as "Add the pricing slide".'

export function airaSystem(deck: string): string {
  return `${airaRole} The deck for this conversation is ${deck}.\n\n${instructions}`
}

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
  readonly tools: readonly ModelTool[]
  readonly messages: readonly ModelMessage[]
  readonly metadata: { readonly user_id: string }
  readonly output_config: { readonly effort: AiraEffort }
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

export type Transport = (call: ModelCall, key: string, signal: AbortSignal) => Promise<ModelOpen>

export type AiraSettings = {
  readonly on: boolean
  readonly key: string | undefined
  readonly secret: string | undefined
  readonly transport: Transport
  readonly log?: (line: string) => void
  readonly model?: string
  readonly effort?: AiraEffort
}

export type AiraHost = {
  readonly settings: AiraSettings | undefined
  readonly db: Sql
  readonly now: () => number
  readonly mint: () => string
  readonly closing: Closing
}

export type AiraAnswer = { readonly status: number; readonly body: unknown }

export type AiraLine =
  | AiraEvent
  | {
      readonly type: "end"
      readonly ok: true
      readonly stop: string
      readonly content: readonly ReplyBlock[]
      readonly usage: WeekUsage
    }
  | { readonly type: "end"; readonly ok: false; readonly refusal: "dropped" | "unavailable"; readonly usage: WeekUsage }

export type AiraStream = { readonly status: 200; readonly lines: AsyncIterable<AiraLine> }

type Asked = {
  readonly account: string
  readonly user: string
  readonly id: string
  readonly input: number
  readonly key: string
  readonly transport: Transport
  readonly call: ModelCall
}

type Reserved =
  | { readonly ok: true; readonly ledger: Stored }
  | { readonly ok: false; readonly refusal: "open" | "allowance"; readonly ledger: Stored }
  | { readonly ok: false; readonly refusal: "rate"; readonly text: string }

const noUsage = { search: 0, searchOn: false, usOnly: false } as const

export function accountId(secret: string, account: string): string {
  return createHmac("sha256", secret).update(account).digest("hex")
}

function wordBytes(messages: readonly ModelMessage[]): number {
  const screenshots = screenshotsIn(messages)
  return bytesOf(JSON.stringify(messages)) - screenshots.reduce((total, { source }) => total + source.data.length, 0)
}

function inputCeiling(system: string, messages: readonly ModelMessage[]): number {
  const screenshots = screenshotsIn(messages).length * screenshotTokenCeiling
  return bytesOf(system) + bytesOf(JSON.stringify(airaTools)) + wordBytes(messages) + screenshots + framing
}

function refuse(status: number, refusal: string, extra: Record<string, unknown> = {}): AiraAnswer {
  return { status, body: { ok: false, refusal, ...extra } }
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
  const command = outcome === "settled" ? "settle" : "stop"
  const result = applied(ledger, { command, id, ...counts, ...noUsage })
  if (!result.accepted) return ledger
  await writeLedger(db, account, result.ledger)
  await db.query(
    `update session.aira_turn set outcome = $2, charged = $3, ended = $4 where id = $1 and outcome = 'open'`,
    [id, outcome, result.ledger.spent - ledger.spent, new Date(now)],
  )
  return result.ledger
}

async function dropStale(db: Sql, account: string, ledger: Stored, now: number): Promise<Stored> {
  if (ledger.open === null) return ledger
  const found = await db.query<{ input: number; started: Date }>(
    "select input, started from session.aira_turn where id = $1 and outcome = 'open'",
    [ledger.open.turn],
  )
  const row = found.rows[0]
  if (row === undefined || now - row.started.getTime() < staleTurn) return ledger
  return closeTurn(db, account, ledger, ledger.open.turn, "dropped", unseenCounts(row.input, null), now)
}

function unseenCounts(input: number, started: Reported | null): Counts {
  return {
    input: started?.input ?? input,
    output: airaMaxTokens,
    write5m: started?.write5m ?? 0,
    write1h: 0,
    read: started?.read ?? 0,
  }
}

async function reserveTurn(db: Sql, account: string, id: string, input: number, now: number): Promise<Reserved> {
  return withAddress(db, account, async (client) => {
    const admission = admit(await lockedLog(client, account), "turn", now)
    if (!admission.ok) return { ok: false, refusal: "rate", text: admission.text }
    const stored = await readLedger(client, account, now)
    let ledger = turnOver(await dropStale(client, account, stored, now), now)
    const command = {
      command: "reserve" as const,
      id,
      input,
      maxTokens: airaMaxTokens,
      coldPrefix: 0,
      ...noUsage,
    }
    let result = applied(ledger, command)
    if (
      !result.accepted &&
      ledger.open === null &&
      ledger.spent > 0 &&
      usage({ ...ledger, spent: 0 }, command).accepted
    ) {
      if (await autoResetCredits(client, account, now, `auto_${id}`)) {
        ledger = { ...ledger, spent: 0 }
        result = applied(ledger, command)
      }
    }
    if (!result.accepted) {
      if (ledger !== stored) await writeLedger(client, account, ledger)
      return { ok: false, refusal: ledger.open === null ? "allowance" : "open", ledger }
    }
    await writeLedger(client, account, result.ledger)
    await writeLog(client, account, admission.log)
    await client.query(
      `insert into session.aira_turn (id, email, outcome, input, ceiling, started)
       values ($1, $2, 'open', $3, $4, $5)`,
      [id, account, input, result.ledger.open?.hold ?? 0, new Date(now)],
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

function writeLine(line: string): void {
  process.stdout.write(`${line}\n`)
}

async function* answered(
  host: AiraHost,
  asked: Asked,
  log: (line: string) => void,
  followed: Followed,
): AsyncGenerator<AiraLine> {
  const { account, id, input } = asked
  const { signal } = followed
  try {
    const sent = !(await followed.stopped())
    let opened: ModelOpen = { ok: false, request: null, status: 0, type: "api_error", message: "" }
    if (sent) opened = await asked.transport(asked.call, asked.key, signal).catch(() => opened)
    await noteRequest(host.db, id, opened.request)
    const stopped = sent && signal.aborted
    const played: Played = opened.ok
      ? yield* play(opened.events)
      : stopped
        ? { kind: "dropped", started: null }
        : { kind: "released" }
    const ended = host.now()
    let ledger: Stored
    if (played.kind === "settled") ledger = await settleTurn(host.db, account, id, "settled", played.counts, ended)
    else if (played.kind === "dropped")
      ledger = await settleTurn(host.db, account, id, "dropped", unseenCounts(input, played.started), ended)
    else ledger = await releaseTurn(host.db, account, id, ended)
    const outcome = played.kind === "dropped" && signal.aborted ? "stopped" : played.kind
    log(`aira turn ${id} account ${asked.user} request ${opened.request ?? "none"} outcome ${outcome}`)
    const usage = weekUsage(ledger)
    if (played.kind === "settled") {
      yield { type: "end", ok: true, stop: played.stop, content: played.content, usage }
      return
    }
    yield { type: "end", ok: false, refusal: played.kind === "dropped" ? "dropped" : "unavailable", usage }
  } finally {
    await followed.done()
  }
}

export function airaOffered(country: string | string[] | undefined): boolean {
  return typeof country === "string" && supportedCountries.has(country.toUpperCase())
}

export async function airaTurn(
  host: AiraHost,
  account: string,
  country: string | string[] | undefined,
  raw: unknown,
  left: AbortSignal,
): Promise<AiraAnswer | AiraStream> {
  const settings = host.settings
  if (settings === undefined || !settings.on || settings.key === undefined || settings.secret === undefined) {
    return refuse(403, "off")
  }
  if (!airaOffered(country)) return refuse(403, "country")
  const parsed = readTurn(raw)
  if (!parsed.ok) return refuse(400, "body")
  if (wordBytes(parsed.messages) > airaBodyCap) return refuse(413, "size")
  const followed = await host.closing.follow(account, parsed.ask, left)
  let answer: AiraAnswer | AiraStream | undefined
  try {
    answer = await admitted(
      host,
      { ...settings, key: settings.key, secret: settings.secret },
      account,
      parsed,
      followed,
    )
  } finally {
    if (answer === undefined || !("lines" in answer)) await followed.done()
  }
  return answer
}

async function admitted(
  host: AiraHost,
  settings: AiraSettings & { readonly key: string; readonly secret: string },
  account: string,
  parsed: { readonly deck: string; readonly messages: readonly ModelMessage[] },
  followed: Followed,
): Promise<AiraAnswer | AiraStream> {
  const now = host.now()
  const id = host.mint()
  const system = airaSystem(parsed.deck)
  const input = inputCeiling(system, parsed.messages)
  let reserved = await reserveTurn(host.db, account, id, input, now)
  if (!reserved.ok && reserved.refusal === "open") {
    await host.closing.closed(account, followed)
    reserved = await reserveTurn(host.db, account, id, input, host.now())
  }
  if (!reserved.ok && reserved.refusal === "rate") return refuse(429, "rate", { text: reserved.text })
  if (!reserved.ok)
    return refuse(reserved.refusal === "open" ? 409 : 402, reserved.refusal, {
      usage: weekUsage(reserved.ledger),
    })
  const user = accountId(settings.secret, account)
  const call: ModelCall = {
    model: settings.model ?? airaModel,
    max_tokens: airaMaxTokens,
    system,
    tools: airaTools,
    messages: parsed.messages,
    metadata: { user_id: user },
    output_config: { effort: settings.effort ?? airaEffort },
  }
  const asked = { account, user, id, input, key: settings.key, transport: settings.transport, call }
  return { status: 200, lines: answered(host, asked, settings.log ?? writeLine, followed) }
}
