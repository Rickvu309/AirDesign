import { execFileSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import type { AddressInfo } from "node:net"
import { join } from "node:path"
import { expect, test as base, type BrowserContext, type Page } from "@playwright/test"
import type { Script } from "../../apps/api/src/aira-replay.ts"

export const cleanFixture = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")

type Mail = { readonly to: string; readonly text: string }
type Landed = { readonly value: string; readonly visible: boolean }
export type SavedRegister = { readonly elements: Record<string, { readonly landed: readonly Landed[] }> }
export type Answer = {
  readonly status: number
  readonly json: Record<string, unknown>
  readonly cookie: string | undefined
}
export type Stack = {
  readonly origin: string
  readonly mcp: string
  readonly post: (path: string, body: unknown, cookie?: string) => Promise<Answer>
  readonly callTool: (name: string, args: unknown, cookie: string) => Promise<Record<string, unknown>>
  readonly signIn: () => Promise<string>
  readonly saved: (deck: string) => Promise<{ owner: string; register: SavedRegister } | undefined>
  readonly emailOf: (cookie: string) => Promise<string>
  readonly aira: (...scripts: readonly [Script, ...Script[]]) => void
  readonly hold: () => Promise<void>
  readonly release: () => void
  readonly exhaust: (cookie: string) => Promise<void>
}

export const test = base.extend<object, { stack: Stack }>({
  stack: [
    async ({}, use) => {
      execFileSync("pnpm", ["--filter", "@airdesign/api", "build"], { stdio: "ignore" })
      const { startEmptyCluster } = await import("../../apps/api/src/postgres-setup.js")
      const { runBootstrap, runSetup } = await import("../../apps/api/src/provision.js")
      const { openPool } = await import("../../apps/api/src/pool.js")
      const { DeckListen } = await import("../../apps/api/src/listen.js")
      const { createApi } = await import("../../apps/api/src/server.js")
      const { Replay } = await import("../../apps/api/src/aira-replay.js")
      const { mcpRoutes, signInRoutes } = await import("../../packages/catalog/src/index.ts")
      const { allowance } = await import("../../packages/usage/src/index.ts")
      const cluster = await startEmptyCluster()
      const role = (name: string) =>
        `postgres://${name}:${randomBytes(18).toString("hex")}@127.0.0.1:${String(cluster.port)}/api`
      const environment = {
        ADMIN_DATABASE_URL: cluster.admin,
        SESSION_DATABASE_URL: role("session"),
        DECK_DATABASE_URL: role("deck"),
        LISTEN_DATABASE_URL: role("listen"),
        MIGRATOR_DATABASE_URL: role("migrator"),
      }
      const lines: string[] = []
      const write = (_: string, line: string) => {
        lines.push(line)
      }
      if ((await runBootstrap(environment, write)) !== 0) throw new Error(lines.join("\n"))
      if ((await runSetup(environment, write)) !== 0) throw new Error(lines.join("\n"))
      const session = openPool(environment.SESSION_DATABASE_URL, "browser-session")
      const deck = openPool(environment.DECK_DATABASE_URL, "browser-deck")
      const admin = openPool(cluster.admin, "browser-admin")
      const listen = new DeckListen(environment.LISTEN_DATABASE_URL)
      const mails: Mail[] = []
      const replay = new Replay()
      const server = createApi({
        session,
        deck,
        listen,
        publicOrigin: "https://app.example",
        siteOrigin: "https://site.example",
        resource: "https://mcp.example.test/mcp",
        aira: {
          on: true,
          key: "browser-key-not-real",
          secret: "browser-secret-not-real",
          transport: replay.transport,
          log: () => undefined,
        },
        send: async (mail) => {
          mails.push(mail)
        },
      })
      await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve())
      })
      const origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`
      async function post(path: string, body: unknown, cookie?: string): Promise<Answer> {
        const response = await fetch(`${origin}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", ...(cookie === undefined ? {} : { cookie }) },
          body: JSON.stringify(body),
        })
        const text = await response.text()
        return {
          status: response.status,
          json: text.length === 0 ? {} : (JSON.parse(text) as Record<string, unknown>),
          cookie: response.headers.getSetCookie()[0]?.split(";")[0],
        }
      }
      const owners = new Map<string, string>()
      await use({
        origin,
        mcp: mcpRoutes.mcp.path,
        post,
        async callTool(name, args, cookie) {
          const response = await fetch(`${origin}${mcpRoutes.mcp.path}`, {
            method: "POST",
            headers: { "content-type": "application/json", accept: "application/json, text/event-stream", cookie },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
          })
          const data = (await response.text()).split("\n").find((line) => line.startsWith("data:"))
          const answer = JSON.parse(data?.slice("data:".length) ?? "{}") as {
            result?: { structuredContent?: Record<string, unknown> }
          }
          return answer.result?.structuredContent ?? {}
        },
        async signIn() {
          const email = `person${randomBytes(4).toString("hex")}@example.com`
          expect((await post(signInRoutes.email.path, { email })).status).toBe(202)
          const code = mails.find((mail) => mail.to === email)?.text.split("\n")[1]
          const signed = await post(signInRoutes.code.path, { email, code })
          expect(signed.status).toBe(200)
          if (signed.cookie === undefined) throw new Error("cookie")
          owners.set(signed.cookie, email)
          return signed.cookie
        },
        emailOf: async (cookie) => owners.get(cookie) ?? "",
        async saved(id) {
          const found = await admin.query<{ owner: string; register: SavedRegister }>(
            "select owner, register from deck.saved where id = $1 and deleted is null",
            [id],
          )
          return found.rows[0]
        },
        aira: (...scripts) => replay.play(...scripts),
        hold: () => replay.hold(),
        release: () => replay.release(),
        async exhaust(cookie) {
          await admin.query(
            `insert into session.aira_ledger (email, spent, monday)
             values ($1, $2, date_trunc('week', now() at time zone 'utc') at time zone 'utc')
             on conflict (email) do update set spent = excluded.spent`,
            [owners.get(cookie), allowance],
          )
        },
      })
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
        server.closeAllConnections()
      })
      await listen.close()
      await Promise.all([session.end(), deck.end(), admin.end()])
      await cluster.stop()
    },
    { scope: "worker", timeout: 120_000 },
  ],
})

export async function signInBrowser(context: BrowserContext, cookie: string): Promise<void> {
  const split = cookie.indexOf("=")
  await context.addCookies([
    {
      name: cookie.slice(0, split),
      value: cookie.slice(split + 1),
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ])
}

const forwarded = ["/decks/", "/sign-in/"]
const streamed = "/aira/"

export async function forward(page: Page, stack: Stack): Promise<string[]> {
  const asked: string[] = []
  await page.route(
    (url) =>
      url.pathname === stack.mcp ||
      url.pathname.startsWith(streamed) ||
      forwarded.some((path) => url.pathname.startsWith(path)),
    async (route) => {
      const request = route.request()
      const { pathname, search } = new URL(request.url())
      asked.push(pathname)
      const headers = { ...(await request.allHeaders()), "cf-ipcountry": "US" }
      if (pathname.startsWith(streamed)) {
        await route.continue({ url: `${stack.origin}${pathname}${search}`, headers })
        return
      }
      try {
        const answer = await route.fetch({
          url: `${stack.origin}${pathname}${search}`,
          headers,
        })
        await route.fulfill({ response: answer })
      } catch {
        await route.abort().catch(() => undefined)
      }
    },
  )
  return asked
}

export async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

export async function openClean(page: Page): Promise<string> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(cleanFixture)
  await page.waitForFunction(() => /^\/deck\/[A-Za-z0-9_-]{1,64}$/.test(location.pathname))
  await settled(page)
  return new URL(page.url()).pathname.slice("/deck/".length)
}
