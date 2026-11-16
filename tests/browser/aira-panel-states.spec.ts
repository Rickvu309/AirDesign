import { expect, type BrowserContext, type Page } from "@playwright/test"
import { airaCopy, airaRefusalWords } from "../../apps/web/src/copy/aira-copy.ts"
import { forward, openClean, signInBrowser, test, type Stack } from "./api-stack"

const node = "256.2"
const asked = "Change the title to Hello from Aira"
const longTitle =
  "Make the Q3 investor update lead with the number that matters most to the board, then the three risks behind it"
const longAsk = `${longTitle}. Keep it calm.`
const reason = airaRefusalWords.stale

test.use({ viewport: { width: 1600, height: 1000 }, locale: "en-US", timezoneId: "Asia/Ho_Chi_Minh" })

async function openDeck(page: Page, context: BrowserContext, stack: Stack, country = "US") {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  const paths = await forward(page, stack, country)
  const deck = await openClean(page)
  const base = (await stack.post("/decks/open", { deck }, cookie)).json.revision
  const side = page.locator("[data-editor-panel]")
  return { cookie, deck, base: String(base), paths, side, log: side.getByRole("log") }
}

async function ask(page: Page, text: string) {
  await page.locator("[data-editor-panel]").getByRole("textbox", { name: "Ask Aira" }).fill(text)
  await page.keyboard.press("Enter")
}

test("where Aira is not offered, the panel says so as it opens and its composer is off for the same reason", async ({
  page,
  context,
  stack,
}) => {
  const { side, paths } = await openDeck(page, context, stack, "CN")
  await expect(side.getByText(airaCopy.notOffered, { exact: true })).toBeVisible()
  const composer = side.getByRole("textbox", { name: airaCopy.notOffered })
  await expect(composer).toBeDisabled()
  await expect(composer).toHaveAttribute("placeholder", airaCopy.notOffered)
  await expect(side.getByRole("button", { name: "Send" })).toBeDisabled()
  await expect(side.getByRole("button", { name: airaCopy.retry })).toHaveCount(0)
  expect(paths).not.toContain("/aira/turn")
})

test("a running step shows a progress mark that stops moving with reduced motion, and a finished step a check", async ({
  page,
  context,
  stack,
}) => {
  const { deck, base, side } = await openDeck(page, context, stack)
  stack.aira({ name: "edit.sse", fill: { deck, base, node } }, { name: "edited.sse" })
  let open = () => {}
  const gate = new Promise<void>((resolve) => {
    open = resolve
  })
  await page.route(
    (url) => url.pathname === stack.mcp,
    async (route) => {
      await gate
      await route.fallback()
    },
  )
  await ask(page, asked)
  const running = side.locator('[data-tool-state="working"]')
  await expect(running).toHaveText("Editing slides")
  const mark = running.locator('[data-step-mark="progress"]')
  await expect(mark).toBeVisible()
  const title = running.getByText("Editing slides", { exact: true })
  const titleMotion = () => title.evaluate((box) => box.getAnimations().length)
  expect(await titleMotion()).toBe(0)
  const motion = () => mark.evaluate((box) => getComputedStyle(box).animationName)
  expect(await motion()).not.toBe("none")
  await page.emulateMedia({ reducedMotion: "reduce" })
  expect(await motion()).toBe("none")
  expect(await titleMotion()).toBe(0)
  await expect(mark).toBeVisible()
  await page.emulateMedia({ reducedMotion: "no-preference" })
  open()
  const finished = side.locator('[data-tool-state="done"]')
  await expect(finished).toHaveText("Edited slides")
  await expect(finished.locator('[data-step-mark="check"]')).toBeVisible()
  await expect(side.locator('[data-step-mark="progress"]')).toHaveCount(0)
})

test("Try again retries a failed request in place, with no second copy of the request or its error", async ({
  page,
  context,
  stack,
}) => {
  const { side, log } = await openDeck(page, context, stack)
  stack.aira({ name: "overloaded.sse" }, { name: "turn.sse" })
  await ask(page, asked)
  await expect(side.getByText(airaCopy.failedTitle, { exact: true })).toBeVisible()
  await expect(side.getByText(airaCopy.failedNothing, { exact: true })).toBeVisible()
  await side.getByRole("button", { name: airaCopy.retry }).click()
  await expect(side.getByText("Lead with the claim. Then show the evidence.", { exact: true })).toBeVisible()
  await expect(log.getByText(asked, { exact: true })).toHaveCount(1)
  await expect(side.getByRole("button", { name: airaCopy.retry })).toHaveCount(0)
  await expect(side.getByText(airaCopy.failedTitle, { exact: true })).toHaveCount(0)
})

test("a step refused because the person typed in the same title says why, flags the reply, and retries in place", async ({
  page,
  context,
  stack,
}) => {
  const { cookie, deck, base, side, log } = await openDeck(page, context, stack)
  stack.aira({ name: "edit.sse", fill: { deck, base, node } }, { name: "edited.sse" }, { name: "turn.sse" })
  let open = () => {}
  const gate = new Promise<void>((resolve) => {
    open = resolve
  })
  await page.route(
    (url) => url.pathname === stack.mcp,
    async (route) => {
      await gate
      await route.fallback()
    },
  )
  await ask(page, asked)
  await expect(side.locator('[data-tool-state="working"]')).toHaveText("Editing slides")
  await page.locator('[data-slide-paint] [contenteditable="true"]').first().click()
  await page.keyboard.type("X")
  await page.keyboard.press("Escape")
  await expect
    .poll(async () => (await stack.post("/decks/open", { deck }, cookie)).json.revision)
    .toBeGreaterThan(Number(base))
  open()
  const refused = side.locator('[data-tool-state="refused"]')
  await expect(refused).toHaveText("Couldn't edit slides")
  await expect(side.locator("[data-step-reason]")).toHaveText(reason)
  await expect(side.getByText(airaCopy.stepsFailedTitle, { exact: true })).toBeVisible()
  await expect(side.getByText(airaCopy.stepsFailedBody, { exact: true })).toBeVisible()
  await side.getByRole("button", { name: airaCopy.retry }).click()
  await expect(side.getByText("Lead with the claim. Then show the evidence.", { exact: true })).toBeVisible()
  await expect(log.getByText(asked, { exact: true })).toHaveCount(1)
  await expect(side.getByText(airaCopy.stepsFailedTitle, { exact: true })).toHaveCount(0)
  await expect(side.getByRole("button", { name: airaCopy.retry })).toHaveCount(0)
  await expect(refused).toHaveCount(1)
})

test("a request that ran out of usage offers no Try again", async ({ page, context, stack }) => {
  const { cookie, side } = await openDeck(page, context, stack)
  await stack.exhaust(cookie)
  await ask(page, asked)
  await expect(side.getByText("You've hit this week's limit", { exact: true })).toBeVisible()
  await expect(side.getByRole("button", { name: airaCopy.retry })).toHaveCount(0)
})

test("a long chat title in the history menu is cut with an ellipsis on one line and kept whole in its title", async ({
  page,
  context,
  stack,
}) => {
  const { side } = await openDeck(page, context, stack)
  stack.aira({ name: "turn.sse" })
  await ask(page, longAsk)
  await expect(side.getByText("Lead with the claim. Then show the evidence.", { exact: true })).toBeVisible()
  await side.getByRole("button", { name: "New chat", exact: true }).click()
  await side.locator("[data-aira-history]").click()
  const item = page.locator("[data-aira-chats]").getByRole("menuitemradio")
  await expect(item).toHaveAttribute("title", longTitle)
  const line = item.getByText(longTitle, { exact: true })
  const style = await line.evaluate((box) => {
    const { textOverflow, whiteSpace } = getComputedStyle(box)
    return { textOverflow, whiteSpace, cut: box.scrollWidth > box.clientWidth }
  })
  expect(style).toEqual({ textOverflow: "ellipsis", whiteSpace: "nowrap", cut: true })
})
