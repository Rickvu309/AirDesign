import { readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

export type Production = {
  readonly web: string
  readonly api: string
  readonly state: string
}

export const deployed: Production = {
  web: "https://studio.airdesign.app",
  api: "https://api-production-f919c062.up.railway.app",
  state: join(tmpdir(), "airdesign-production-session.json"),
}

const smokeEmail = "smoke@airdesign.app"

type StoredCookie = { readonly name: string; readonly value: string }
type Listed = { readonly deck: string }
type DeckList = {
  readonly ok?: boolean
  readonly account?: { readonly email?: string }
  readonly decks?: readonly Listed[]
  readonly trash?: readonly Listed[]
}

export async function sessionCookie(production: Production): Promise<string> {
  const stored = JSON.parse(await readFile(production.state, "utf8")) as { cookies: StoredCookie[] }
  return stored.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
}

function catalog(): Promise<typeof import("../../packages/catalog/src/index.ts")> {
  return import("../../packages/catalog/src/index.ts")
}

async function postJson(production: Production, path: string, body: unknown, cookie: string): Promise<unknown> {
  const answer = await fetch(`${production.web}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  if (answer.status !== 200) throw new Error(`${path} answered ${String(answer.status)}`)
  return answer.json()
}

async function smokeDecks(production: Production, cookie: string): Promise<{ live: string[]; all: string[] }> {
  const { deckRoutes } = await catalog()
  const list = (await postJson(production, deckRoutes.list.path, {}, cookie)) as DeckList
  if (list.ok !== true) throw new Error("/decks/list refused the smoke session")
  if (list.account?.email !== smokeEmail) throw new Error("the session is not the smoke account")
  const live = (list.decks ?? []).map((row) => row.deck)
  return { live, all: [...live, ...(list.trash ?? []).map((row) => row.deck)] }
}

async function findBrowserLibraries(): Promise<void> {
  const { browserEnv } = (await import(
    pathToFileURL(join(process.cwd(), ".agents/skills/verify-airdesign/bin/browser.mjs")).href
  )) as { browserEnv: (env: NodeJS.ProcessEnv) => NodeJS.ProcessEnv }
  const libraries = browserEnv(process.env).LD_LIBRARY_PATH
  if (libraries !== undefined) process.env.LD_LIBRARY_PATH = libraries
}

export default async function openProduction(): Promise<() => Promise<void>> {
  const production = deployed
  await findBrowserLibraries()
  const token = process.env.SMOKE_TOKEN
  if (token === undefined || token.length === 0) throw new Error("SMOKE_TOKEN is not set")
  const opened = await fetch(`${production.api}/smoke/session`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  })
  if (opened.status !== 200) throw new Error(`/smoke/session answered ${String(opened.status)}`)
  const pairs = opened.headers
    .getSetCookie()
    .map((header) => header.split(";")[0] ?? "")
    .filter((pair) => pair.includes("=") && !pair.endsWith("="))
  if (pairs.length === 0) throw new Error("/smoke/session set no cookie")
  const { accountCookieName } = await catalog()
  const domain = new URL(production.web).hostname
  const cookies = pairs.map((pair) => {
    const split = pair.indexOf("=")
    const name = pair.slice(0, split)
    return {
      name,
      value: pair.slice(split + 1),
      domain,
      path: "/",
      expires: -1,
      httpOnly: name !== accountCookieName,
      secure: true,
      sameSite: "Lax" as const,
    }
  })
  await writeFile(production.state, JSON.stringify({ cookies, origins: [] }), { mode: 0o600 })
  const cookie = await sessionCookie(production)
  const { deckIdFor } = (await import(pathToFileURL(join(process.cwd(), "scripts/smoke.mjs")).href)) as {
    deckIdFor: (token: string) => string
  }
  const kept = new Set([...(await smokeDecks(production, cookie)).all, deckIdFor(token)])
  return async () => {
    try {
      const made = (await smokeDecks(production, cookie)).live.filter((deck) => !kept.has(deck))
      const refused: string[] = []
      for (const deck of made) {
        const trashed = await trash(production, deck, cookie)
        if (!trashed) refused.push(deck)
      }
      process.stdout.write(
        `moved ${String(made.length - refused.length)} of ${String(made.length)} decks the run made to Trash: ${made.join(", ")}\n`,
      )
      if (refused.length > 0) throw new Error(`Trash refused ${refused.join(", ")}`)
    } finally {
      await rm(production.state, { force: true })
    }
  }
}

async function trash(production: Production, deck: string, cookie: string): Promise<boolean> {
  const { deckRoutes } = await catalog()
  try {
    return ((await postJson(production, deckRoutes.trash.path, { deck }, cookie)) as { ok?: boolean }).ok === true
  } catch {
    return false
  }
}
