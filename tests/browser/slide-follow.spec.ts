import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { expect, type Page } from "@playwright/test"
import type { ReadDeckAnswer, ReadElement } from "../../packages/engine/src/index.ts"
import { forward, signInBrowser, test } from "./api-stack"

const duplicate = process.platform === "darwin" ? "Meta+d" : "Control+d"
const blank = join(process.cwd(), "scripts/pptx-fixtures/blank.pptx")

function value(text: string, run = 0): string {
  return JSON.stringify([{ from: 0, runs: [{ from: run, text }] }])
}

test.use({ viewport: { width: 1600, height: 1000 } })

function entry(page: Page, number: number) {
  return page.locator(`[data-slide-entry="${number}"]`)
}

async function serveOriginals(
  page: Page,
  originals: {
    put(url: string, bytes: Uint8Array, headers: Readonly<Record<string, string>>): void
    get(url: string): Uint8Array
  },
): Promise<void> {
  const allow = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "PUT, GET, OPTIONS",
    "access-control-allow-headers": "*",
  }
  await page.route(
    (url) => url.hostname === "original.test",
    async (route) => {
      const request = route.request()
      if (request.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: allow })
        return
      }
      try {
        if (request.method() === "PUT") {
          const bytes = new Uint8Array(request.postDataBuffer() ?? Buffer.alloc(0))
          originals.put(request.url(), bytes, { ...request.headers(), "content-length": String(bytes.byteLength) })
          await route.fulfill({ status: 200, headers: allow, body: "" })
          return
        }
        await route.fulfill({
          status: 200,
          headers: allow,
          body: Buffer.from(originals.get(request.url())),
          contentType: "application/octet-stream",
        })
      } catch (error) {
        await route.fulfill({ status: request.method() === "PUT" ? 412 : 404, headers: allow, body: String(error) })
      }
    },
  )
}

async function elementOn(
  stack: { callTool: (name: string, args: unknown, cookie: string) => Promise<Record<string, unknown>> },
  deck: string,
  slide: string,
  node: string,
  cookie: string,
): Promise<ReadElement | undefined> {
  const read = (await stack.callTool("airdesign_read_deck", { deck, slide }, cookie)) as ReadDeckAnswer
  return read.elements?.find((row) => row.node === node)
}

test("a cleared browser rebuilds a duplicate from the server's snapshot, not from the source's later text", async ({
  page,
  context,
  stack,
  decks,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await serveOriginals(page, stack.originals)
  await forward(page, stack)
  const deck = await decks.open()
  const editor = page.locator('[contenteditable="true"]')
  await editor.dblclick()
  await page.keyboard.press("ControlOrMeta+a")
  await editor.pressSequentially("Before the copy", { delay: 20 })
  await expect(editor).toHaveText("Before the copy")
  await expect
    .poll(async () => (await elementOn(stack, deck, "256", "256.2", cookie))?.value ?? "")
    .toContain("Before the copy")
  await entry(page, 1).focus()
  await page.keyboard.press(duplicate)
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect(page.locator('[data-slide-paint] [contenteditable="true"]')).toHaveText("Before the copy")
  await expect
    .poll(async () => (await elementOn(stack, deck, "257", "257.2", cookie))?.value ?? "")
    .toContain("Before the copy")
  await entry(page, 1).click()
  await editor.dblclick()
  await page.keyboard.press("ControlOrMeta+a")
  await editor.pressSequentially("Source after", { delay: 20 })
  await expect(editor).toHaveText("Source after")
  await expect
    .poll(async () => (await elementOn(stack, deck, "256", "256.2", cookie))?.value ?? "")
    .toContain("Source after")
  const { deckRoutes } = await import("../../packages/catalog/src/index.ts")
  await expect.poll(async () => (await stack.post(deckRoutes.original.path, { deck }, cookie)).json.ok).toBe(true)
  expect((await elementOn(stack, deck, "257", "257.2", cookie))?.value ?? "").toContain("Before the copy")
  const address = page.url()
  await page.goto("/version")
  const cleared = join(process.cwd(), ".agents/skills/verify-airdesign/bin/clear-browser.mjs")
  const { clearBrowser } = (await import(pathToFileURL(cleared).href)) as {
    clearBrowser: (page: Page) => Promise<void>
  }
  await clearBrowser(page)
  await page.goto(address)
  await decks.ready()
  await entry(page, 1).click()
  await expect(page.locator('[data-slide-paint] [contenteditable="true"]')).toHaveText("Source after")
  await entry(page, 2).click()
  await expect(page.locator('[data-slide-paint] [contenteditable="true"]')).toHaveText("Before the copy")
})

test("an agent's edit of a cloned slide and of an added slide paints in the open editor", async ({
  page,
  context,
  stack,
  decks,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await serveOriginals(page, stack.originals)
  await forward(page, stack)
  const deck = await decks.open()
  await page.evaluate(() => {
    document.body.dataset.sameLoad = "yes"
  })
  await entry(page, 1).focus()
  await page.keyboard.press(duplicate)
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect.poll(async () => (await elementOn(stack, deck, "257", "257.2", cookie))?.node).toBe("257.2")
  const opened = await elementOn(stack, deck, "257", "257.2", cookie)
  if (opened === undefined) throw new Error("copy")
  const base = (await stack.post("/decks/open", { deck }, cookie)).json.revision
  const edited = await stack.callTool(
    "airdesign_edit_deck",
    { deck, base, changes: [{ node: "257.2", readAt: opened.version, value: value("Hello on the copy") }] },
    cookie,
  )
  expect(edited).toMatchObject({ ok: true })
  await expect(page.locator('[data-slide-paint] [contenteditable="true"]')).toHaveText("Hello on the copy")
  await entry(page, 1).click()
  await expect(page.locator('[data-slide-paint] [contenteditable="true"]')).toHaveText("Hello")
  expect(await page.evaluate(() => document.body.dataset.sameLoad)).toBe("yes")
  await decks.open(blank)
  await page.evaluate(() => {
    document.body.dataset.sameLoad = "yes"
  })
  const fresh = new URL(page.url()).pathname.slice("/deck/".length)
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect.poll(async () => (await elementOn(stack, fresh, "257", "257.2", cookie))?.node).toBe("257.2")
  const placeholder = await elementOn(stack, fresh, "257", "257.2", cookie)
  if (placeholder === undefined) throw new Error("placeholder")
  const next = (await stack.post("/decks/open", { deck: fresh }, cookie)).json.revision
  const typed = await stack.callTool(
    "airdesign_edit_deck",
    {
      deck: fresh,
      base: next,
      changes: [{ node: "257.2", readAt: placeholder.version, value: value("Typed by an agent", -1) }],
    },
    cookie,
  )
  if (typed.ok !== true) throw new Error(JSON.stringify(typed))
  await expect(
    page.locator(`[data-slide-paint] [data-canvas-element="ppt/slides/slide2.xml#2"] [contenteditable="true"]`),
  ).toHaveText("Typed by an agent")
  expect(await page.evaluate(() => document.body.dataset.sameLoad)).toBe("yes")
})
