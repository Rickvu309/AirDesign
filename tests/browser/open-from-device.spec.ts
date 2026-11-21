import { expect, type Page, type Route } from "@playwright/test"
import { openRegister } from "../../packages/document/src/index.ts"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { decksOn, test } from "./deck-test"

const refusedWords = productCopy.deckNotFoundTitle

type Server = {
  mode: "answer" | "hold" | "refuse"
  refusal: string
  readonly held: Route[]
  readonly asked: string[]
}

async function serve(page: Page): Promise<Server> {
  const server: Server = { mode: "answer", refusal: "deleted", held: [], asked: [] }
  await page.route("**/decks/open", async (route) => {
    const { deck } = route.request().postDataJSON() as { deck: string }
    server.asked.push(deck)
    if (server.mode === "hold") {
      server.held.push(route)
      return
    }
    if (server.mode === "refuse") {
      await route.fulfill({ json: { ok: false, refusal: server.refusal } })
      return
    }
    await route.fulfill({ json: { ok: true, deck, revision: 0, register: openRegister("", "") } })
  })
  await page.route("**/decks/index", async (route) => {
    const { deck } = route.request().postDataJSON() as { deck: string }
    await route.fulfill({ json: { ok: true, deck, revision: 0 } })
  })
  await page.route("**/decks/watch", async (route) => {
    if (server.mode !== "refuse") return
    await route.fulfill({ json: { ok: false, refusal: server.refusal } })
  })
  await page.route("**/decks/list", (route) =>
    route.fulfill({ json: { ok: true, account: { email: "first@example.com" }, decks: [], trash: [] } }),
  )
  await page.route("**/decks/rename", (route) => route.fulfill({ json: { ok: true } }))
  return server
}

async function importClean(page: Page): Promise<string> {
  return `/deck/${await decksOn(page).open()}`
}

async function askedOnce(server: Server, count: number): Promise<void> {
  await expect.poll(() => server.asked.length).toBeGreaterThanOrEqual(count)
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("a deck already on the device paints while the server holds the open", async ({ page }) => {
  const server = await serve(page)
  const address = await importClean(page)
  server.mode = "hold"
  server.asked.length = 0
  await page.goto(address)
  await askedOnce(server, 1)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  expect(server.held).toHaveLength(1)
})

test("an edit made while the server holds the open paints at once and is there after a reload", async ({ page }) => {
  const server = await serve(page)
  const address = await importClean(page)
  server.mode = "hold"
  await page.goto(address)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.dblclick()
  await page.keyboard.press("End")
  await editor.pressSequentially("!", { delay: 50 })
  await expect(editor).toHaveText("Hello!")
  await page.goto(address)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello!")
})

test("the server refusing the deck after it painted shows the refusal and stops edits", async ({ page }) => {
  const server = await serve(page)
  const address = await importClean(page)
  server.mode = "hold"
  server.asked.length = 0
  await page.goto(address)
  await askedOnce(server, 1)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  server.mode = "refuse"
  for (const route of server.held.splice(0)) await route.fulfill({ json: { ok: false, refusal: "deleted" } })
  await expect(page.getByText(refusedWords)).toBeVisible()
  await expect(page.locator("[data-deck-refused]")).toBeVisible()
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Export" })).toHaveCount(0)
})

test("a deck on the device is not painted for the next person to sign in", async ({ page }) => {
  const server = await serve(page)
  await page.route("**/sign-out", (route) =>
    route.fulfill({
      json: { ok: true },
      headers: { "set-cookie": "airdesign.account=; SameSite=Lax; Path=/; Max-Age=0" },
    }),
  )
  await page.route("**/sign-in?*", (route) => route.fulfill({ body: "Sign in" }))
  const address = await importClean(page)
  await page.goto("/")
  await page.getByRole("button", { name: "first@example.com" }).click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/sign-in\?next=/)
  server.mode = "hold"
  server.asked.length = 0
  await page.goto(address)
  await askedOnce(server, 1)
  await expect(page.locator(".thin-page")).toBeVisible()
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
  server.mode = "refuse"
  server.refusal = "owner"
  for (const route of server.held.splice(0)) await route.fulfill({ json: { ok: false, refusal: "owner" } })
  await expect(page.locator("[data-deck-refused]")).toBeVisible()
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
})
