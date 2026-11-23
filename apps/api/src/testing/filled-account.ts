import { createHash, randomBytes } from "node:crypto"
import {
  airaRoutes,
  countryHeader,
  deckRoutes,
  doomRoutes,
  mcpRoutes,
  oauthRoutes,
  signInRoutes,
} from "@airdesign/catalog"

import { ask, askForm, cookieFrom, verifierPair } from "./harness.js"
import type { Mail, OriginalUpload, Sql } from "../index.js"
import type { LocalOriginalStore } from "../platform/local-original-store.js"
import { readSignInMail } from "../account/sign-in-mail.js"

export type Served = { readonly base: string; readonly mails: readonly Mail[]; readonly store: LocalOriginalStore }

export type Filled = {
  readonly email: string
  readonly cookie: string
  readonly clientId: string
  readonly access: string
  readonly refresh: string
  readonly decks: readonly string[]
  readonly grants: readonly string[]
}

const callback = "http://127.0.0.1:8124/account"
const bytes = Buffer.from("a picture on the deck")
const sha256 = createHash("sha256").update(bytes).digest("hex")

export async function signIn(served: Served, email: string): Promise<string> {
  const index = served.mails.length
  await ask(served.base, "POST", signInRoutes.email.path, { email })
  const { code } = readSignInMail(served.mails[index]?.text ?? "")
  const signed = await ask(served.base, "POST", signInRoutes.code.path, { email, code })
  const cookie = cookieFrom(signed.headers)
  if (cookie === undefined) throw new Error("cookie")
  return cookie
}

async function posted(served: Served, path: string, body: unknown, cookie: string): Promise<unknown> {
  const reply = await ask(served.base, "POST", path, body, cookie)
  if (reply.status !== 200) throw new Error(`${path} ${reply.text}`)
  return reply.json
}

async function storedDeck(served: Served, cookie: string): Promise<string> {
  const deck = `account${randomBytes(4).toString("hex")}`
  await posted(served, doomRoutes.create.path, { deck }, cookie)
  const signed = (await posted(
    served,
    deckRoutes.mediaUpload.path,
    { deck, bytes: bytes.length, sha256 },
    cookie,
  )) as OriginalUpload
  served.store.put(signed.url, bytes, signed.headers)
  return deck
}

async function pairOf(served: Served, fields: Record<string, string>): Promise<{ access: string; refresh: string }> {
  const reply = await askForm(served.base, oauthRoutes.token.path, fields)
  const body = reply.json as { access_token?: string; refresh_token?: string }
  if (body.access_token === undefined || body.refresh_token === undefined) throw new Error(reply.text)
  return { access: body.access_token, refresh: body.refresh_token }
}

async function connected(
  served: Served,
  cookie: string,
): Promise<{ clientId: string; access: string; refresh: string }> {
  const registered = await ask(served.base, "POST", oauthRoutes.register.path, { redirect_uris: [callback] })
  const clientId = (registered.json as { client_id: string }).client_id
  const { verifier, challenge } = verifierPair()
  const approved = (await posted(
    served,
    oauthRoutes.approve.path,
    { client_id: clientId, redirect_uri: callback, code_challenge: challenge, code_challenge_method: "S256" },
    cookie,
  )) as { redirect: string }
  const code = new URL(approved.redirect).searchParams.get("code") ?? ""
  const first = await pairOf(served, {
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    client_id: clientId,
    redirect_uri: callback,
  })
  const rotated = await pairOf(served, {
    grant_type: "refresh_token",
    refresh_token: first.refresh,
    client_id: clientId,
  })
  return { clientId, ...rotated }
}

export async function fillAccount(served: Served, sql: Sql, email: string): Promise<Filled> {
  const cookie = await signIn(served, email)
  const decks = [await storedDeck(served, cookie), await storedDeck(served, cookie)]
  await posted(served, deckRoutes.trash.path, { deck: decks[1] }, cookie)
  const oauth = await connected(served, cookie)
  await agentEdit(served, oauth.access)
  const asked = { deck: decks[0], messages: [{ role: "user", content: "Fuzz" }] }
  const turn = await ask(served.base, "POST", airaRoutes.turn.path, asked, cookie, { [countryHeader]: "VN" })
  if (turn.status !== 200) throw new Error(turn.text)
  await ask(served.base, "POST", signInRoutes.email.path, { email })
  await sql.query("insert into session.credits (email, cents) values ($1, 500)", [email])
  await sql.query("insert into session.credit_history (email, once, at, cents) values ($1, 'reset', now(), -500)", [
    email,
  ])
  const grants = await sql.query<{ id: string }>("select id from session.oauth_grant where principal = $1", [email])
  return { email, cookie, decks, grants: grants.rows.map((row) => row.id), ...oauth }
}

export const accountTables = [
  ["session.account", "email = $1", "email"],
  ["session.code", "email = $1", "email"],
  ["session.access", "email = $1", "email"],
  ["session.sent", "email = $1", "email"],
  ["session.oauth_grant", "principal = $1", "email"],
  ["session.oauth_token", "grant_id = any($1::text[])", "grants"],
  ["session.aira_ledger", "email = $1", "email"],
  ["session.aira_turn", "email = $1", "email"],
  ["session.aira_ask", "email = $1", "email"],
  ["session.caller_log", "email = $1", "email"],
  ["session.agent_turn", "email = $1", "email"],
  ["session.credits", "email = $1", "email"],
  ["session.credit_history", "email = $1", "email"],
  ["deck.doom", "owner = $1", "email"],
  ["deck.doom_edit", "deck in (select id from deck.doom where owner = $1)", "email"],
  ["deck.doom_node", "deck in (select id from deck.doom where owner = $1)", "email"],
  ["deck.media", "deck = any($1::text[])", "decks"],
  ["deck.original_delete", "owner = $1", "email"],
] as const

export async function personalRows(sql: Sql, filled: Filled): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const [table, where, key] of accountTables) {
    const found = await sql.query<{ rows: number }>(`select count(*)::int as rows from ${table} where ${where}`, [
      filled[key],
    ])
    counts[table] = found.rows[0]?.rows ?? 0
  }
  return counts
}

export function emptied(counts: Record<string, number>): readonly string[] {
  return Object.entries(counts)
    .filter(([, rows]) => rows === 0)
    .map(([table]) => table)
}

export function storedKeys(store: LocalOriginalStore, email: string): readonly string[] {
  const account = createHash("sha256").update(email).digest("hex")
  return [...store.objects.keys()].filter((key) => key.startsWith(`media/${account}/`))
}

async function agentCall(served: Served, access: string, name: string, args: unknown): Promise<Record<string, any>> {
  const response = await fetch(`${served.base}${mcpRoutes.mcp.path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${access}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  const text = await response.text()
  const reply = text.startsWith("{")
    ? text
    : (text.split("\n").find((line) => line.startsWith("data: ")) ?? "").slice(6)
  const answered = (JSON.parse(reply) as { result?: { structuredContent?: Record<string, any> } }).result
    ?.structuredContent
  if (answered?.ok !== true) throw new Error(text)
  return answered
}

async function agentEdit(served: Served, access: string): Promise<void> {
  const made = await agentCall(served, access, "airdesign_create_deck", {})
  await agentCall(served, access, "airdesign_edit_deck", {
    deck: made.deck,
    base: made.rev,
    changes: [{ op: "add", kind: "text", slide: made.slides[0], text: "agent" }],
  })
}

export async function mcpStatus(served: Served, access: string): Promise<number> {
  const response = await fetch(`${served.base}${mcpRoutes.mcp.path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${access}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  })
  await response.text()
  return response.status
}
