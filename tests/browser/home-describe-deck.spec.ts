import { expect, type Page } from "@playwright/test"
import { editorCopy } from "../../apps/web/src/copy/editor-copy.ts"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import { forward, signInBrowser, test } from "./api-stack"

test.use({ viewport: { width: 1600, height: 1000 }, locale: "en-US" })

const words = "A board update on Q3 revenue, numbers first"

test("describing a deck on the Aira page makes a deck and sends the words to Aira once, and a reload does not send them again", async ({
  page,
  context,
  stack,
}) => {
  await signInBrowser(context, await stack.signIn())
  const called = await forward(page, stack)
  stack.aira({ name: "turn.sse" })
  await page.goto("/aira")
  const box = page.getByRole("textbox", { name: productCopy.describeDeck })
  await box.fill(words)
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/s\/[A-Za-z0-9_-]{1,64}(\?node-id=.*)?$/)
  await page.locator("[data-editor-ready]").waitFor()
  expect(page.url()).not.toContain("Q3")
  const log = page.locator("[data-editor-panel]").getByRole("log")
  await expect(log.getByText(words, { exact: true })).toBeVisible()
  await expect(log.getByText("Lead with the claim. Then show the evidence.", { exact: true })).toBeVisible()
  const sent = () => called.filter((path) => path === "/aira/turn").length
  const first = sent()
  expect(first).toBe(1)

  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  await expect(log.getByText(words, { exact: true })).toHaveCount(1)
  expect(sent()).toBe(first)
})

function holdCreate(page: Page) {
  let release = () => {}
  const held = new Promise<void>((done) => {
    release = done
  })
  let body: string | null = null
  const seen = page.route("**/doom/create", async (route) => {
    body = route.request().postData()
    await held
    await route.abort().catch(() => undefined)
  })
  return { release, seen, posted: () => body }
}

const listed = (page: Page) =>
  page.evaluate(async () => {
    const response = await fetch("/decks/list", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
    const body = (await response.json()) as { decks?: unknown[]; trash?: unknown[] }
    return (body.decks?.length ?? 0) + (body.trash?.length ?? 0)
  })

test("pressing Back while the deck opens puts the words back and leaves no blank deck", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const hold = holdCreate(page)
  await hold.seen
  try {
    await page.goto("/aira")
    const box = page.getByRole("textbox", { name: productCopy.describeDeck })
    await box.fill(words)
    const asked = page.waitForRequest("**/doom/create")
    await page.keyboard.press("Enter")
    await asked
    await expect(page.getByLabel(editorCopy.loading)).toBeVisible()
    await page.goBack()
    await expect(box).toHaveValue(words)
    await expect(page.locator("[data-loading]")).toHaveCount(0)
    await expect(page.getByRole("heading", { name: productCopy.blankDeck, exact: true })).toHaveCount(0)
  } finally {
    hold.release()
  }
  const raw = hold.posted()
  if (raw === null) throw new Error("the deck was never asked for")
  expect((await stack.post("/doom/create", JSON.parse(raw) as { deck: string }, cookie)).json).toMatchObject({
    ok: true,
  })
  await expect.poll(() => listed(page)).toBe(1)
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect.poll(() => listed(page)).toBe(0)
  await expect(page.getByRole("heading", { name: productCopy.blankDeck, exact: true })).toHaveCount(0)
  await expect(page.getByRole("textbox", { name: productCopy.describeDeck })).toHaveValue(words)
})
