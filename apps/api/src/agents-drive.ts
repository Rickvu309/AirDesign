import { randomBytes } from "node:crypto"

import { deckRoutes, mcpRoutes, oauthRoutes, signInRoutes } from "@airdesign/catalog"

import { agentKey } from "./agent-key.js"
import { ask, askForm, cookieFrom, postgresInfo, serve, verifierPair } from "./harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"
import { readSignInMail } from "./sign-in-mail.js"

const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }

export const idleWindow = 600_000
export const x = "258.7"
export const y = "258.8"
export const clock = { now: 1_700_000_000_000 }
export const gate: { held: { opened: Promise<void>; armed: boolean } | undefined } = { held: undefined }
export const address = { base: "" }
export const stores: { deck: Sql; session: Sql } = {
  deck: undefined as unknown as Sql,
  session: undefined as unknown as Sql,
}

const mails: Mail[] = []

export async function startAgents(): Promise<() => Promise<void>> {
  const info = await postgresInfo()
  const sessionPool = openPool(info.session, "agents-session")
  const deckPool = openPool(info.deck, "agents-deck")
  stores.deck = deckPool
  stores.session = sessionPool
  const deck = new Proxy(deckPool, {
    get(target, prop, receiver) {
      if (prop !== "query") return Reflect.get(target, prop, receiver)
      const query = target.query.bind(target) as (sql: unknown, params?: unknown[]) => Promise<unknown>
      return async (sql: unknown, params?: unknown[]) => {
        if (typeof sql === "string" && sql.includes("update deck.saved") && gate.held?.armed === true) {
          gate.held.armed = false
          await gate.held.opened
        }
        return query(sql, params)
      }
    },
  }) as Sql
  const listen = new DeckListen(info.listen)
  const served = await serve({
    ...origins,
    session: sessionPool,
    deck,
    listen,
    now: () => clock.now,
    send: async (mail) => void mails.push(mail),
  })
  address.base = served.base
  return async () => {
    await served.close()
    await listen.close()
    await sessionPool.end()
    await deckPool.end()
  }
}

export type Account = { readonly email: string; readonly cookie: string }

export async function account(): Promise<Account> {
  const email = `agents${randomBytes(5).toString("hex")}@example.com`
  await ask(address.base, "POST", signInRoutes.email.path, { email })
  const mail = mails.find((sent) => sent.to === email)
  const { code } = readSignInMail(mail?.text ?? "")
  const signed = await ask(address.base, "POST", signInRoutes.code.path, { email, code })
  const cookie = cookieFrom(signed.headers)
  if (cookie === undefined) throw new Error("cookie")
  return { email, cookie }
}

export async function grant(owner: Account, name: string): Promise<string> {
  return (await granted(owner, name)).token
}

export async function granted(owner: Account, name: string): Promise<{ readonly token: string; readonly key: string }> {
  const redirectUri = `https://${name}.example/callback`
  const registered = await ask(address.base, "POST", oauthRoutes.register.path, {
    redirect_uris: [redirectUri],
    client_name: name,
  })
  const clientId = (registered.json as { client_id: string }).client_id
  const { verifier, challenge } = verifierPair()
  const approved = await ask(
    address.base,
    "POST",
    oauthRoutes.approve.path,
    { client_id: clientId, redirect_uri: redirectUri, code_challenge: challenge, code_challenge_method: "S256" },
    owner.cookie,
  )
  const code = new URL((approved.json as { redirect: string }).redirect).searchParams.get("code") ?? ""
  const exchanged = await askForm(address.base, oauthRoutes.token.path, {
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    client_id: clientId,
    redirect_uri: redirectUri,
  })
  const row = await stores.session.query<{ id: string }>("select id from session.oauth_grant where client_id = $1", [
    clientId,
  ])
  return {
    token: (exchanged.json as { access_token: string }).access_token,
    key: agentKey("grant", row.rows[0]?.id ?? ""),
  }
}

export type Answer = { readonly ok: boolean; readonly text: string; readonly body: Record<string, unknown> }

export type Agent = {
  readonly call: (tool: string, args: Record<string, unknown>) => Promise<Answer>
}

export async function connected(headers: Record<string, string>): Promise<Agent> {
  return {
    call: async (tool, args) => {
      const response = await fetch(`${address.base}${mcpRoutes.mcp.path}`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: `airdesign_${tool}`, arguments: args },
        }),
      })
      const text = await response.text()
      const line = text.startsWith("{")
        ? text
        : (text
            .split("\n")
            .find((each) => each.startsWith("data: "))
            ?.slice(6) ?? "")
      const result = (
        JSON.parse(line) as { result: { isError?: boolean; content: { text: string }[]; structuredContent?: unknown } }
      ).result
      return {
        ok: result.isError !== true,
        text: result.content[0]?.text ?? "",
        body: (result.structuredContent ?? {}) as Record<string, unknown>,
      }
    },
  }
}

export type Pairing = "two agents" | "Aira and an agent"

export async function agents(owner: Account, pairing: Pairing): Promise<readonly [Agent, Agent]> {
  const second = await connected({ authorization: `Bearer ${await grant(owner, "codex")}` })
  if (pairing === "Aira and an agent") return [await connected({ cookie: owner.cookie }), second]
  return [await connected({ authorization: `Bearer ${await grant(owner, "claude")}` }), second]
}

export async function deckOf(owner: Account): Promise<string> {
  const id = `deck${randomBytes(5).toString("hex")}`
  await ask(address.base, "POST", deckRoutes.open.path, { deck: id }, owner.cookie)
  return id
}

export function edit(deck: string, node: string, value: string, readAt: number) {
  return { deck, base: 0, changes: [{ node, value, readAt }] }
}

type Row = { readonly value: string; readonly visible: boolean; readonly runId?: string }

async function rows(deck: string, node: string): Promise<readonly Row[]> {
  const found = await stores.deck.query<{ register: { elements: Record<string, { landed: readonly Row[] }> } }>(
    "select register from deck.saved where id = $1",
    [deck],
  )
  return found.rows[0]?.register.elements[node]?.landed ?? []
}

export async function shown(deck: string, node: string): Promise<string | undefined> {
  return (await rows(deck, node)).filter((row) => row.visible).at(-1)?.value
}

export async function turnRuns(owner: Account, deck: string): Promise<readonly (string | null)[]> {
  const found = await stores.session.query<{ run_id: string | null }>(
    "select run_id from session.agent_turn where email = $1 and deck = $2 order by run_id",
    [owner.email, deck],
  )
  return found.rows.map((row) => row.run_id)
}

export function versionOf(answer: Answer, node: string): number {
  const elements = (answer.body.elements ?? []) as readonly { readonly node: string; readonly version: number }[]
  const found = elements.find((element) => element.node === node)
  if (found === undefined) throw new Error(JSON.stringify(answer))
  return found.version
}
