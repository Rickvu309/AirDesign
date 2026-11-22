import { randomBytes } from "node:crypto"

import { deckRoutes, mcpRoutes, oauthRoutes, signInRoutes } from "@airdesign/catalog"

import { ask, askForm, cookieFrom, postgresInfo, serve, verifierPair } from "./harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"
import { readSignInMail } from "./sign-in-mail.js"

const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }

export const clock = { now: 1_700_000_000_000 }
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
  const listen = new DeckListen(info.listen)
  const served = await serve({
    ...origins,
    session: sessionPool,
    deck: deckPool,
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
  return (exchanged.json as { access_token: string }).access_token
}

export type Answer = {
  readonly ok: boolean
  readonly text: string
  readonly said: string
  readonly body: Record<string, unknown>
}

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
        said: result.content.map((block) => block.text).join("\n"),
        body: (result.structuredContent ?? {}) as Record<string, unknown>,
      }
    },
  }
}

export async function deckOf(owner: Account): Promise<string> {
  const id = `deck${randomBytes(5).toString("hex")}`
  await ask(address.base, "POST", deckRoutes.open.path, { deck: id }, owner.cookie)
  return id
}
