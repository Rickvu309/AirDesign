import { execFileSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import type { AddressInfo } from "node:net"
import { join } from "node:path"
import { expect, test as base, type BrowserContext, type Page } from "@playwright/test"

const fixture = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")
const typed = "Saved on the server"

type Mail = { readonly to: string; readonly text: string }
type Landed = { readonly value: string; readonly visible: boolean }
type SavedRegister = { readonly elements: Record<string, { readonly landed: readonly Landed[] }> }
type Answer = { readonly status: number; readonly json: Record<string, unknown>; readonly cookie: string | undefined }
type Stack = {
  readonly origin: string
  readonly post: (path: string, body: unknown, cookie?: string) => Promise<Answer>
  readonly signIn: () => Promise<string>
  readonly saved: (deck: string) => Promise<{ owner: string; register: SavedRegister } | undefined>
  readonly emailOf: (cookie: string) => Promise<string>
}

const test = base.extend<object, { stack: Stack }>({
  stack: [
    async ({}, use) => {
      execFileSync("pnpm", ["--filter", "@airdesign/api", "build"], { stdio: "ignore" })
      const { startEmptyCluster } = await import("../../apps/api/src/postgres-setup.js")
      const { runBootstrap, runSetup } = await import("../../apps/api/src/provision.js")
      const { openPool } = await import("../../apps/api/src/pool.js")
      const { DeckListen } = await import("../../apps/api/src/listen.js")
      const { createApi } = await import("../../apps/api/src/server.js")
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
      const session = openPool(environment.SESSION_DATABASE_URL, "real-save-session")
      const deck = openPool(environment.DECK_DATABASE_URL, "real-save-deck")
      const admin = openPool(cluster.admin, "real-save-admin")
      const listen = new DeckListen(environment.LISTEN_DATABASE_URL)
      const mails: Mail[] = []
      const server = createApi({
        session,
        deck,
        listen,
        publicOrigin: "https://app.example",
        siteOrigin: "https://site.example",
        resource: "https://mcp.example.test/mcp",
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
        post,
        async signIn() {
          const email = `person${randomBytes(4).toString("hex")}@example.com`
          expect((await post("/sign-in/email", { email })).status).toBe(202)
          const code = mails.find((mail) => mail.to === email)?.text.split("\n")[1]
          const signed = await post("/sign-in/code", { email, code })
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

test.use({ viewport: { width: 1600, height: 1000 } })

function textOf(value: string): string {
  const paragraphs = JSON.parse(value) as { runs: { text: string }[] }[]
  return paragraphs.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n")
}

function textsIn(register: SavedRegister): string[] {
  return Object.values(register.elements).flatMap((element) => {
    const last = element.landed.filter((landed) => landed.visible).at(-1)
    return last === undefined ? [] : [textOf(last.value)]
  })
}

async function signInBrowser(context: BrowserContext, cookie: string): Promise<void> {
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

async function forward(page: Page, stack: Stack): Promise<string[]> {
  const asked: string[] = []
  await page.route(
    (url) => url.pathname.startsWith("/decks/") || url.pathname.startsWith("/sign-in/"),
    async (route) => {
      const request = route.request()
      const { pathname, search } = new URL(request.url())
      asked.push(pathname)
      const answer = await route.fetch({
        url: `${stack.origin}${pathname}${search}`,
        headers: await request.allHeaders(),
      })
      await route.fulfill({ response: answer })
    },
  )
  return asked
}

async function deckRows(page: Page): Promise<{ kind: string; value: string }[]> {
  return page.evaluate(
    () =>
      new Promise<{ kind: string; value: string }[]>((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const all = database.transaction("rows", "readonly").objectStore("rows").getAll()
          all.onerror = () => reject(all.error)
          all.onsuccess = () => {
            database.close()
            resolve(
              (all.result as unknown[]).filter(
                (row) => typeof row === "object" && row !== null && "kind" in row,
              ) as never,
            )
          }
        }
      }),
  )
}

async function forgetDeckRows(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction("rows", "readwrite")
          transaction.onerror = () => reject(transaction.error)
          transaction.oncomplete = () => {
            database.close()
            resolve()
          }
          const cursor = transaction.objectStore("rows").openCursor()
          cursor.onsuccess = () => {
            const at = cursor.result
            if (at === null) return
            const row = at.value as unknown
            if (typeof row === "object" && row !== null && "kind" in row) at.delete()
            at.continue()
          }
        }
      }),
  )
}

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/thin\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

async function openClean(page: Page): Promise<string> {
  await page.goto("/thin")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await page.waitForFunction(() => /^\/thin\/[A-Za-z0-9_-]{1,64}$/.test(location.pathname))
  await settled(page)
  return new URL(page.url()).pathname.slice("/thin/".length)
}

async function typeOver(page: Page, text: string): Promise<void> {
  const editor = page.locator('[contenteditable="true"]')
  await editor.click()
  await page.keyboard.press("ControlOrMeta+a")
  await editor.pressSequentially(text, { delay: 50 })
  await expect(editor).toHaveText(text)
}

async function confirmedText(page: Page, text: string): Promise<void> {
  await expect
    .poll(async () => {
      const rows = await deckRows(page)
      return {
        pending: rows.filter((row) => row.kind === "pending").length,
        last: rows.map((row) => textOf(row.value)),
      }
    })
    .toMatchObject({ pending: 0, last: expect.arrayContaining([text]) })
}

test("a typed edit lands in Postgres and comes back from the server", async ({ page, context, stack }) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  const asked = await forward(page, stack)
  const deck = await openClean(page)
  await typeOver(page, typed)
  await confirmedText(page, typed)
  expect(asked[0]).toBe("/decks/open")
  expect(asked.filter((path) => path === "/decks/open")).toHaveLength(1)
  expect(asked.filter((path) => path === "/decks/commit").length).toBeGreaterThan(0)

  const saved = await stack.saved(deck)
  expect(saved?.owner).toBe(await stack.emailOf(cookie))
  expect(saved === undefined ? [] : textsIn(saved.register)).toEqual([typed])

  const opened = await stack.post("/decks/open", { deck }, cookie)
  expect(opened.status).toBe(200)
  expect(opened.json.ok).toBe(true)
  expect(textsIn(opened.json.register as SavedRegister)).toEqual([typed])

  await forgetDeckRows(page)
  expect(await deckRows(page)).toEqual([])
  await page.reload()
  await settled(page)
  await expect(page.locator('[contenteditable="true"]')).toHaveText(typed)
})

test("a second account opening the deck is refused owner", async ({ page, context, stack }) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  const deck = await openClean(page)
  await typeOver(page, typed)
  await confirmedText(page, typed)
  const other = await stack.signIn()
  const refused = await stack.post("/decks/open", { deck }, other)
  expect(refused.json).toEqual({ ok: false, refusal: "owner" })
  expect(textsIn((await stack.saved(deck))?.register ?? { elements: {} })).toEqual([typed])
})

test("an edit to a deck deleted on the server keeps its row and does not bring the deck back", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  const asked = await forward(page, stack)
  const deck = await openClean(page)
  await typeOver(page, typed)
  await confirmedText(page, typed)
  expect((await stack.post("/decks/trash", { deck }, cookie)).json.ok).toBe(true)
  expect((await stack.post("/decks/delete", { decks: [deck] }, cookie)).json.ok).toBe(true)
  expect(await stack.saved(deck)).toBeUndefined()
  const commits = asked.filter((path) => path === "/decks/commit").length
  await page.locator('[contenteditable="true"]').pressSequentially("!", { delay: 50 })
  await expect.poll(() => asked.filter((path) => path === "/decks/commit").length).toBeGreaterThan(commits)
  await expect
    .poll(async () => (await deckRows(page)).filter((row) => row.kind === "pending").map((row) => textOf(row.value)))
    .toEqual([`${typed}!`])
  expect(await stack.saved(deck)).toBeUndefined()
})

test("a reload does not bring back a deck deleted on the server", async ({ page, context, stack }) => {
  test.fail()
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  const asked = await forward(page, stack)
  const deck = await openClean(page)
  await typeOver(page, typed)
  await confirmedText(page, typed)
  expect((await stack.post("/decks/trash", { deck }, cookie)).json.ok).toBe(true)
  expect((await stack.post("/decks/delete", { decks: [deck] }, cookie)).json.ok).toBe(true)
  const commits = asked.filter((path) => path === "/decks/commit").length
  await page.locator('[contenteditable="true"]').pressSequentially("!", { delay: 50 })
  await expect.poll(() => asked.filter((path) => path === "/decks/commit").length).toBeGreaterThan(commits)
  await page.reload()
  await expect(page.locator(".thin-page[data-deck-ready]")).toHaveCount(1)
  await expect.poll(async () => (await deckRows(page)).filter((row) => row.kind === "pending").length).toBe(0)
  expect(await stack.saved(deck)).toBeUndefined()
})
