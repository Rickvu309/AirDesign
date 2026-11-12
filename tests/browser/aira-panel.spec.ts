import { expect, type BrowserContext, type Page } from "@playwright/test"
import { airaBackOn, airaCopy, airaLimitBodyOn } from "../../apps/web/src/copy/aira-copy.ts"
import { productCopy, usageResetsOn } from "../../apps/web/src/copy/product-copy.ts"
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
  await expect(side.getByRole("textbox", { name: airaCopy.addToRequest })).toBeVisible()
  stack.release()
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello from Aira")
  await expect(side.getByText("I will change the title on the first slide.", { exact: true })).toBeVisible()
  await expect(side.getByText("Edited slides", { exact: true })).toBeVisible()
  await expect(side.getByText(/airdesign_/)).toHaveCount(0)
  await expect(side.getByText("The title now reads Hello from Aira.", { exact: true })).toBeVisible()
  await expect(side.getByRole("button", { name: "Stop" })).toHaveCount(0)
  await expect(side.getByRole("button", { name: productCopy.undo })).toBeVisible()
  await side.getByRole("button", { name: productCopy.usageTitle }).click()
  const usage = side.getByRole("region", { name: productCopy.usageTitle })
  await expect(usage).toContainText(/\d+%/)
  await expect(usage).toContainText(usageResetsOn("Mon 7:00 AM"))
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

test("Stop ends an edit call the server has not answered, and the step says it stopped", async ({
  page,
  context,
  stack,
}) => {
  const { deck, base, side } = await openDeck(page, context, stack)
  stack.aira({ name: "edit.sse", fill: { deck, base: String(base), node } }, { name: "edited.sse" })
  let reachedCall: () => void = () => undefined
  const reached = new Promise<void>((resolve) => {
    reachedCall = resolve
  })
  await page.route("**/mcp", () => reachedCall())
  await ask(page, asked)
  await reached
  await expect(side.getByText("Editing slides", { exact: true })).toBeVisible()
  await side.getByRole("button", { name: "Stop" }).click()
  await expect(side.getByRole("button", { name: "Stop" })).toHaveCount(0)
  await expect(side.getByRole("textbox", { name: "Ask Aira" })).toBeVisible()
  await expect(side.getByText("Stopped editing slides", { exact: true })).toBeVisible()
})

test.fail(
  "Stop after an edit reached the server offers Undo for the edit that landed",
  async ({ page, context, stack }) => {
    const { deck, base, side } = await openDeck(page, context, stack)
    stack.aira({ name: "edit.sse", fill: { deck, base: String(base), node } }, { name: "edited.sse" })
    let reachedCall: () => void = () => undefined
    const reached = new Promise<void>((resolve) => {
      reachedCall = resolve
    })
    let answer: () => void = () => undefined
    const answered = new Promise<void>((resolve) => {
      answer = resolve
    })
    await page.route("**/mcp", async (route) => {
      const request = route.request()
      const landed = await route.fetch({ url: `${stack.origin}${stack.mcp}`, headers: await request.allHeaders() })
      reachedCall()
      await answered
      await route.fulfill({ response: landed }).catch(() => undefined)
    })
    await ask(page, asked)
    await reached
    await side.getByRole("button", { name: "Stop" }).click()
    answer()
    await expect(side.getByText("Stopped editing slides", { exact: true })).toBeVisible()
    await expect(page.locator('[data-slide-paint] [contenteditable="true"]')).toHaveText("Hello from Aira")
    await expect(side.getByRole("button", { name: "Undo", exact: true })).toBeVisible({ timeout: 3000 })
  },
)

test("after Stop the usage ring shows what the stopped model call was charged", async ({ page, context, stack }) => {
  const { deck, base, side } = await openDeck(page, context, stack)
  await side.getByRole("button", { name: productCopy.usageTitle }).click()
  const usage = side.getByRole("region", { name: productCopy.usageTitle })
  await expect(usage).toContainText("0%")
  stack.aira({ name: "edit.sse", fill: { deck, base: String(base), node }, holdAfter: 3 })
  const reached = stack.hold()
  await ask(page, asked)
  await reached
  await side.getByRole("button", { name: "Stop" }).click()
  try {
    await expect(usage).toContainText(/[1-9]\d*%/)
  } finally {
    stack.release()
  }
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
  await expect(side.getByText(airaLimitBodyOn("Mon 7:00 AM"), { exact: true })).toBeVisible()
  await expect(log.getByText(asked, { exact: true })).toBeVisible()
  await expect(side.getByRole("textbox", { name: airaBackOn("Mon 7:00 AM") })).toBeDisabled()
  await side.getByRole("button", { name: productCopy.usageTitle }).click()
  await expect(side.getByRole("region", { name: productCopy.usageTitle })).toContainText("100%")
  expect(paths).not.toContain("/mcp")
})

test("a failed run says so, and Design stays disabled while the conversation stays", async ({
  page,
  context,
  stack,
}) => {
  const { side, log } = await openDeck(page, context, stack)
  stack.aira({ name: "overloaded.sse" })
  await ask(page, asked)
  await expect(side.getByText(airaCopy.failedTitle, { exact: true })).toBeVisible()
  await expect(side.getByText(airaCopy.failedNothing, { exact: true })).toBeVisible()
  await expect(side.getByRole("textbox", { name: "Ask Aira" })).toBeEnabled()
  await expect(page.getByRole("button", { name: productCopy.designOff })).toBeDisabled()
  await expect(log.getByText(asked, { exact: true })).toBeVisible()
  await side.getByRole("button", { name: "New chat", exact: true }).click()
  await expect(log.getByText(asked, { exact: true })).toHaveCount(0)
})

test("a new ask right after Stop is answered once the server has stopped and closed the first model call", async ({
  page,
  context,
  stack,
}) => {
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
  await expect(entries.first()).toHaveAttribute("aria-current", "true")
  await entries.first().focus()
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

test("a new deck's panel says who Aira is, and Enter sends while Shift+Enter starts a new line", async ({
  page,
  context,
  stack,
}) => {
  const { side } = await openDeck(page, context, stack)
  await expect(side.getByRole("heading", { name: productCopy.agentName })).toBeVisible()
  await expect(side.getByText(airaCopy.welcome, { exact: true })).toBeVisible()
  await expect(side.getByText(airaCopy.caution, { exact: true })).toBeVisible()
  await expect(side.getByRole("button", { name: "New chat", exact: true })).toBeDisabled()
  await expect(side.getByRole("button", { name: "Send" })).toBeDisabled()
  stack.aira({ name: "turn.sse" })
  const composer = side.getByRole("textbox", { name: "Ask Aira" })
  await composer.fill("Lead with")
  await composer.press("Shift+Enter")
  await composer.pressSequentially("the claim")
  await expect(composer).toHaveValue("Lead with\nthe claim")
  await expect(side.getByRole("log")).toHaveCount(0)
  await composer.press("Enter")
  await expect(side.getByRole("log").getByText("Lead with\nthe claim", { exact: true })).toBeVisible()
  await expect(side.getByText("Lead with the claim. Then show the evidence.", { exact: true })).toBeVisible()
  await expect(side.getByRole("heading", { name: productCopy.agentName })).toHaveCount(0)
})

test("steps Aira takes one after another sum up in one line that opens to each step", async ({
  page,
  context,
  stack,
}) => {
  const { deck, base, side } = await openDeck(page, context, stack)
  stack.aira({ name: "read-edit.sse", fill: { deck, base: String(base), node } }, { name: "edited.sse" })
  await ask(page, asked)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello from Aira")
  const summary = side.getByRole("button", { name: "Read the deck and edited slides" })
  await expect(summary).toHaveAttribute("aria-expanded", "false")
  await summary.click()
  await expect(summary).toHaveAttribute("aria-expanded", "true")
  const steps = side.locator('li[data-tool-state="done"]')
  await expect(steps).toHaveText(["Read the deck", "Edited slides"])
  await summary.click()
  await expect(steps).toHaveCount(0)
})

test("the thread follows the reply at the latest message and stays put once the person scrolls up", async ({
  page,
  context,
  stack,
}) => {
  const { side, log } = await openDeck(page, context, stack)
  stack.aira({ name: "turn.sse", holdAfter: 2 })
  const reached = stack.hold()
  await ask(page, Array.from({ length: 80 }, (_, line) => `Line ${String(line + 1)} of my notes`).join("\n"))
  await reached
  const gap = () => log.evaluate((box) => box.scrollHeight - box.scrollTop - box.clientHeight)
  await expect.poll(gap).toBeLessThanOrEqual(8)
  await log.evaluate((box) => {
    box.scrollTop = 0
  })
  const jump = side.locator("button[data-shown]")
  await expect(jump).toHaveAttribute("data-shown", "true")
  await expect(side.getByRole("button", { name: airaCopy.latest })).toBeVisible()
  stack.release()
  await expect(side.getByText("Lead with the claim. Then show the evidence.", { exact: true })).toBeAttached()
  expect(await log.evaluate((box) => box.scrollTop)).toBe(0)
  await jump.click()
  await expect.poll(gap).toBeLessThanOrEqual(8)
  await expect(jump).toHaveAttribute("data-shown", "false")
})
