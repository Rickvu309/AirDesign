import { expect, type BrowserContext, type Page } from "@playwright/test"
import { productCopy, usageLimitBodyOn, usageResetsOn } from "../../apps/web/src/copy/product-copy.ts"
import { forward, openClean, signInBrowser, test, type Stack } from "./api-stack"

const node = "256.2"
const asked = "Change the title to Hello from Aira"

test.use({ viewport: { width: 1600, height: 1000 }, locale: "en-US", timezoneId: "Asia/Ho_Chi_Minh" })

async function openDeck(page: Page, context: BrowserContext, stack: Stack) {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  const paths = await forward(page, stack)
  const deck = await openClean(page)
  const base = (await stack.post("/decks/open", { deck }, cookie)).json.revision
  await page.evaluate(() => {
    document.body.dataset.sameLoad = "yes"
  })
  const side = page.locator("[data-editor-panel]")
  return { cookie, deck, base: Number(base), paths, side, log: side.getByRole("log") }
}

async function serverText(stack: Stack, deck: string, cookie: string): Promise<string | undefined> {
  const opened = (await stack.post("/decks/open", { deck }, cookie)).json as {
    register?: {
      elements?: Record<string, { landed: readonly { value: string; visible: boolean; property?: string }[] }>
    }
  }
  const landed = (opened.register?.elements?.[node]?.landed ?? []).filter(
    (row) => row.visible && row.property !== "box",
  )
  const last = landed.at(-1)
  if (last === undefined) return undefined
  const value = JSON.parse(last.value) as { runs: { text: string }[] }[]
  return value.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n")
}

async function ask(page: Page, text: string) {
  await page.locator("[data-editor-panel]").getByRole("textbox", { name: "Ask Aira" }).fill(text)
  await page.keyboard.press("Enter")
}

test("a person asks Aira, watches the reply stream, and sees the slide change without a reload", async ({
  page,
  context,
  stack,
}) => {
  const { deck, base, side, log } = await openDeck(page, context, stack)
  stack.aira({ name: "edit.sse", fill: { deck, base: String(base), node }, holdAfter: 3 }, { name: "edited.sse" })
  const reached = stack.hold()
  await ask(page, asked)
  await reached
  await expect(log.getByText(asked, { exact: true })).toBeVisible()
  await expect(side.getByText("I will change the title", { exact: true })).toBeVisible()
  await expect(side.getByRole("button", { name: "Stop" })).toBeVisible()
  await expect(side.getByRole("textbox", { name: "Add to the request" })).toBeVisible()
  stack.release()
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello from Aira")
  await expect(side.getByText("I will change the title on the first slide.", { exact: true })).toBeVisible()
  await expect(side.getByText("airdesign_edit_deck", { exact: true })).toBeVisible()
  await expect(side.getByText("The title now reads Hello from Aira.", { exact: true })).toBeVisible()
  await expect(side.getByRole("button", { name: "Stop" })).toHaveCount(0)
  await expect(side.getByRole("button", { name: productCopy.undo })).toBeVisible()
  await side.getByRole("button", { name: productCopy.usageTitle }).click()
  const usage = side.getByRole("region", { name: productCopy.usageTitle })
  await expect(usage).toContainText(/\d+%/)
  await expect(usage).toContainText(usageResetsOn("Monday at 7:00 AM"))
  expect(await page.evaluate(() => document.body.dataset.sameLoad)).toBe("yes")
})

test("Undo takes Aira's run back and the slide paints the old words", async ({ page, context, stack }) => {
  const { cookie, deck, base, side } = await openDeck(page, context, stack)
  stack.aira({ name: "edit.sse", fill: { deck, base: String(base), node } }, { name: "edited.sse" })
  await ask(page, asked)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello from Aira")
  expect(await serverText(stack, deck, cookie)).toBe("Hello from Aira")
  await side.getByRole("button", { name: productCopy.undo }).click()
  await expect(editor).toHaveText("Hello")
  await expect(side.getByRole("button", { name: productCopy.undo })).toHaveCount(0)
  expect(await serverText(stack, deck, cookie)).not.toBe("Hello from Aira")
  expect(await page.evaluate(() => document.body.dataset.sameLoad)).toBe("yes")
})

test("Stop ends the run before Aira's edit lands", async ({ page, context, stack }) => {
  const { cookie, deck, base, paths, side, log } = await openDeck(page, context, stack)
  stack.aira({ name: "edit.sse", fill: { deck, base: String(base), node }, holdAfter: 3 })
  const reached = stack.hold()
  await ask(page, asked)
  await reached
  await expect(side.getByText("I will change the title", { exact: true })).toBeVisible()
  await side.getByRole("button", { name: "Stop" }).click()
  await expect(side.getByRole("button", { name: "Stop" })).toHaveCount(0)
  await expect(side.getByRole("textbox", { name: "Ask Aira" })).toBeVisible()
  stack.release()
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  expect(paths).not.toContain("/mcp")
  expect((await stack.post("/decks/open", { deck }, cookie)).json.revision).toBe(base)
})

test("a person out of weekly usage sees the limit from the server and when it resets", async ({
  page,
  context,
  stack,
}) => {
  const { cookie, paths, side, log } = await openDeck(page, context, stack)
  await stack.exhaust(cookie)
  await ask(page, asked)
  await expect(side.getByText(productCopy.usageLimitTitle, { exact: true })).toBeVisible()
  await expect(side.getByText(usageLimitBodyOn("Monday at 7:00 AM"), { exact: true })).toBeVisible()
  await expect(log.getByText(asked, { exact: true })).toBeVisible()
  await expect(side.getByRole("textbox", { name: usageResetsOn("Monday at 7:00 AM") })).toBeDisabled()
  await side.getByRole("button", { name: productCopy.usageTitle }).click()
  await expect(side.getByRole("region", { name: productCopy.usageTitle })).toContainText("100%")
  expect(paths).not.toContain("/mcp")
})

test("a failed run says so, and the panel switch keeps the conversation", async ({ page, context, stack }) => {
  const { side, log } = await openDeck(page, context, stack)
  stack.aira({ name: "overloaded.sse" })
  await ask(page, asked)
  await expect(side.getByText(productCopy.agentFailedTitle, { exact: true })).toBeVisible()
  await expect(side.getByText(productCopy.agentFailedBody, { exact: true })).toBeVisible()
  await expect(side.getByRole("textbox", { name: "Ask Aira" })).toBeEnabled()
  await page.getByRole("button", { name: "Design" }).click()
  await expect(log.getByText(asked, { exact: true })).toBeHidden()
  await page.getByRole("button", { name: "Agent" }).click()
  await expect(log.getByText(asked, { exact: true })).toBeVisible()
  await side.getByRole("button", { name: "New chat" }).click()
  await expect(log.getByText(asked, { exact: true })).toHaveCount(0)
})

test("a new ask right after Stop is answered while the stopped model call finishes on the server", async ({
  page,
  context,
  stack,
}) => {
  test.fail()
  const { deck, base, side, log } = await openDeck(page, context, stack)
  stack.aira({ name: "edit.sse", fill: { deck, base: String(base), node }, holdAfter: 3 }, { name: "turn.sse" })
  const reached = stack.hold()
  await ask(page, asked)
  await reached
  await side.getByRole("button", { name: "Stop" }).click()
  await ask(page, "Say hello")
  try {
    await expect(log.getByText("Lead with the claim. Then show the evidence.", { exact: true })).toBeVisible()
  } finally {
    stack.release()
  }
})

test("Aira keeps streaming and repainting while a person changes slide order", async ({ page, context, stack }) => {
  const { cookie, deck, base, side } = await openDeck(page, context, stack)
  stack.aira({ name: "edit.sse", fill: { deck, base: String(base), node }, holdAfter: 3 }, { name: "edited.sse" })
  const reached = stack.hold()
  await ask(page, asked)
  await reached
  await page.getByRole("button", { name: "Add slide", exact: true }).click()
  const entries = page.locator("[data-slide-entry]")
  await expect(entries).toHaveCount(2)
  await entries.nth(1).focus()
  await page.keyboard.press("Alt+ArrowUp")
  await page.keyboard.press("Delete")
  await expect(entries).toHaveCount(1)
  stack.release()
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello from Aira")
  await expect(side.getByText("The title now reads Hello from Aira.", { exact: true })).toBeVisible()
  expect(await serverText(stack, deck, cookie)).toBe("Hello from Aira")
  await expect(entries).toHaveCount(1)
})

test("Aira refuses an edit of a slide removed during its reply without hanging", async ({ page, context, stack }) => {
  const { cookie, deck, base, side } = await openDeck(page, context, stack)
  stack.aira({ name: "edit.sse", fill: { deck, base: String(base), node }, holdAfter: 3 }, { name: "edited.sse" })
  const reached = stack.hold()
  await ask(page, asked)
  await reached
  await page.getByRole("button", { name: "Add slide", exact: true }).click()
  const entries = page.locator("[data-slide-entry]")
  await expect(entries).toHaveCount(2)
  await entries.first().focus()
  await page.keyboard.press("Delete")
  await expect(entries).toHaveCount(1)
  await expect.poll(async () => (await stack.post("/decks/open", { deck }, cookie)).json.revision).toBe(base + 2)
  stack.release()
  await expect(side.locator('[data-tool-state="refused"], [data-tool-state="failed"]')).toBeVisible()
  await expect(side.getByRole("button", { name: "Stop" })).toHaveCount(0)
  await expect(side.getByRole("textbox", { name: "Ask Aira" })).toBeEnabled()
  await expect(entries).toHaveCount(1)
})
