import { execFileSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { createServer, request as forwardTo } from "node:http"
import type { AddressInfo } from "node:net"
import { join } from "node:path"
import { expect, test as base, type BrowserContext, type Page } from "@playwright/test"
import type { Script } from "../../apps/api/src/aira-replay.ts"
import { sessionCookie, type Production } from "./production.ts"

export const cleanFixture = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")

type Mail = { readonly to: string; readonly subject: string; readonly text: string; readonly html: string }
type Landed = { readonly value: string; readonly visible: boolean }
export type SavedRegister = { readonly elements: Record<string, { readonly landed: readonly Landed[] }> }
export type Answer = {
  readonly status: number
  readonly json: Record<string, unknown>
  readonly cookie: string | undefined
}
export type Stack = {
  readonly origin: string
  readonly hop: string
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
  readonly originals: {
    put(url: string, bytes: Uint8Array, headers: Readonly<Record<string, string>>): void
    get(url: string): Uint8Array
  }
}

async function startBlindHop(
  target: string,
): Promise<{ readonly origin: string; readonly close: () => Promise<void> }> {
  const hop = createServer((incoming, outgoing) => {
    const headers = Object.fromEntries(Object.entries(incoming.headers).filter(([name]) => name !== "host"))
    const upstream = forwardTo(`${target}${incoming.url ?? "/"}`, { method: incoming.method, headers }, (answer) => {
      outgoing.writeHead(answer.statusCode ?? 502, answer.headers)
      answer.on("data", (chunk: Buffer) => {
        if (!outgoing.destroyed) outgoing.write(chunk)
      })
      answer.on("end", () => outgoing.end())
      answer.on("error", () => outgoing.destroy())
    })
    upstream.on("error", () => outgoing.destroy())
    incoming.pipe(upstream)
  })
  await new Promise<void>((resolve) => {
    hop.listen(0, "127.0.0.1", () => resolve())
  })
  return {
    origin: `http://127.0.0.1:${String((hop.address() as AddressInfo).port)}`,
    close: () =>
      new Promise<void>((resolve) => {
        hop.close(() => resolve())
        hop.closeAllConnections()
      }),
  }
}

function poster(origin: string): Stack["post"] {
  return async (path, body, cookie) => {
    const response = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie === undefined ? {} : { cookie }) },
      body: JSON.stringify(body),
    })
    const text = await response.text()
    return {
      status: response.status,
      json: text.length === 0 ? {} : (JSON.parse(text) as Record<string, unknown>),
      cookie:
        response.headers
          .getSetCookie()
          .map((header) => header.split(";")[0] ?? "")
          .filter((pair) => !pair.endsWith("="))
          .join("; ") || undefined,
    }
  }
}

function toolCaller(origin: string, mcp: string): Stack["callTool"] {
  return async (name, args, cookie) => {
    const response = await fetch(`${origin}${mcp}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", cookie },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    })
    const data = (await response.text()).split("\n").find((line) => line.startsWith("data:"))
    const answer = JSON.parse(data?.slice("data:".length) ?? "{}") as {
      result?: { structuredContent?: Record<string, unknown> }
    }
    return answer.result?.structuredContent ?? {}
  }
}

function localOnly(name: string): () => never {
  return () => {
    throw new Error(`${name} needs the local stack, and this run targets the deployed app`)
  }
}

async function deployedStack(production: Production): Promise<Stack> {
  const cookie = await sessionCookie(production)
  const { mcpRoutes } = await import("../../packages/catalog/src/index.ts")
  return {
    origin: production.web,
    hop: production.web,
    mcp: mcpRoutes.mcp.path,
    post: poster(production.web),
    callTool: toolCaller(production.web, mcpRoutes.mcp.path),
    signIn: async () => cookie,
    saved: localOnly("saved"),
    emailOf: localOnly("emailOf"),
    aira: localOnly("aira"),
    hold: localOnly("hold"),
    release: localOnly("release"),
    exhaust: localOnly("exhaust"),
    originals: { put: localOnly("originals"), get: localOnly("originals") },
  }
}

export const test = base.extend<object, { stack: Stack; production: Production | undefined }>({
  production: [undefined, { option: true, scope: "worker" }],
  stack: [
    async ({ production }, use) => {
      if (production !== undefined) {
        await use(await deployedStack(production))
        return
      }
      execFileSync("pnpm", ["--filter", "@airdesign/api", "build"], { stdio: "ignore" })
      const { startEmptyCluster } = await import("../../apps/api/src/postgres-setup.js")
      const { runBootstrap, runSetup } = await import("../../apps/api/src/provision.js")
      const { openPool } = await import("../../apps/api/src/pool.js")
      const { DeckListen } = await import("../../apps/api/src/listen.js")
      const { createApi } = await import("../../apps/api/src/server.js")
      const { Replay } = await import("../../apps/api/src/aira-replay.js")
      const { readSignInMail } = await import("../../apps/api/src/sign-in-mail.js")
      const { mcpRoutes, signInRoutes, accountRoutes } = await import("../../packages/catalog/src/index.ts")
      const { LocalOriginalStore } = await import("../../apps/api/src/local-original-store.js")
      const originals = new LocalOriginalStore(Date.now, "https://original.test")
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
        originals,
        send: async (mail) => {
          mails.push(mail)
        },
      })
      await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve())
      })
      const origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`
      const hop = await startBlindHop(origin)
      const post = poster(origin)
      const owners = new Map<string, string>()
      await use({
        origin,
        hop: hop.origin,
        mcp: mcpRoutes.mcp.path,
        post,
        callTool: toolCaller(origin, mcpRoutes.mcp.path),
        async signIn() {
          const email = `person${randomBytes(4).toString("hex")}@example.com`
          expect((await post(signInRoutes.email.path, { email })).status).toBe(202)
          const { code } = readSignInMail(mails.find((mail) => mail.to === email)?.text ?? "")
          const signed = await post(signInRoutes.code.path, { email, code })
          expect(signed.status).toBe(200)
          if (signed.cookie === undefined) throw new Error("cookie")
          expect((await post(accountRoutes.name.path, { name: "Person" }, signed.cookie)).status).toBe(200)
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
        originals,
        async exhaust(cookie) {
          await admin.query(
            `insert into session.aira_ledger (email, spent, monday)
             values ($1, $2, date_trunc('week', now() at time zone 'utc') at time zone 'utc')
             on conflict (email) do update set spent = excluded.spent`,
            [owners.get(cookie), allowance],
          )
        },
      })
      await hop.close()
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
  await context.addCookies(
    cookie.split("; ").map((pair) => {
      const split = pair.indexOf("=")
      const name = pair.slice(0, split)
      return {
        name,
        value: pair.slice(split + 1),
        domain: "127.0.0.1",
        path: "/",
        httpOnly: name !== "airdesign.account",
        secure: true,
        sameSite: "Lax" as const,
      }
    }),
  )
}

const forwarded = ["/decks/", "/sign-in/"]
const streamed = "/aira/"

export async function forward(page: Page, stack: Stack, country = "US"): Promise<string[]> {
  const asked: string[] = []
  const { countryHeader } = await import("../../packages/catalog/src/index.ts")
  await page.route(
    (url) =>
      url.pathname === stack.mcp ||
      url.pathname.startsWith(streamed) ||
      forwarded.some((path) => url.pathname.startsWith(path)),
    async (route) => {
      const request = route.request()
      const { pathname, search } = new URL(request.url())
      asked.push(pathname)
      const headers = { ...(await request.allHeaders()), [countryHeader]: country }
      if (pathname.startsWith(streamed)) {
        await route.continue({ url: `${stack.hop}${pathname}${search}`, headers })
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
