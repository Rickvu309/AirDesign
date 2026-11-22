import { expect, type BrowserContext, type Page } from "@playwright/test"
import { airaCopy, airaRefusalWords } from "../../apps/web/src/copy/aira-copy.ts"
import { forward, signInBrowser, test, type Stack } from "./api-stack"
import { decksOn } from "./deck-test"

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
  const deck = await decksOn(page).open()
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
  await expect(side.getByText(`${airaCopy.notOffered} ${airaCopy.notOfferedBody}`, { exact: true })).toBeVisible()
  const composer = side.getByRole("textbox", { name: airaCopy.unavailable })
  await expect(composer).toBeDisabled()
  await expect(composer).toHaveAttribute("placeholder", airaCopy.unavailable)
  await expect(side.getByRole("button", { name: "Send" })).toBeDisabled()
  await expect(side.getByRole("button", { name: airaCopy.retry })).toHaveCount(0)
  expect(paths).not.toContain("/aira/turn")
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

test("a malformed chat blocks asking until New chat restores the composer", async ({ page, context, stack }) => {
  const { side } = await openDeck(page, context, stack)
  await page.route(
    (url) => url.pathname === "/aira/turn",
    (route) => route.fulfill({ status: 400, json: { ok: false, refusal: "body" } }),
    { times: 1 },
  )
  await ask(page, asked)
  await expect(side.getByText(airaCopy.malformedTitle, { exact: true })).toBeVisible()
  const blocked = side.getByRole("textbox", { name: "Start a new chat to ask Aira", exact: true })
  await expect(blocked).toBeDisabled()
  await expect(blocked).toHaveAttribute("placeholder", "Start a new chat to ask Aira")
  await expect(side.getByRole("button", { name: "Send", exact: true })).toBeDisabled()
  await side.locator("[data-aira-stuck]").getByRole("button", { name: "New chat", exact: true }).click()
  await expect(side.getByText(airaCopy.malformedTitle, { exact: true })).toHaveCount(0)
  await expect(side.getByText(airaCopy.welcome, { exact: true })).toBeVisible()
  await expect(side.getByRole("textbox", { name: "Ask Aira", exact: true })).toBeEditable()
  stack.aira({ name: "turn.sse" })
  await ask(page, "Suggest a title")
  await expect(side.getByText("Lead with the claim. Then show the evidence.", { exact: true })).toBeVisible()
})

test("a malformed ending moves focus from the composer to New chat, and New chat back to the composer", async ({
  page,
  context,
  stack,
}) => {
  const { side } = await openDeck(page, context, stack)
  await page.route(
    (url) => url.pathname === "/aira/turn",
    (route) => route.fulfill({ status: 400, json: { ok: false, refusal: "body" } }),
    { times: 1 },
  )
  await ask(page, asked)
  const newChat = side.locator("[data-aira-stuck]").getByRole("button", { name: "New chat", exact: true })
  await expect(newChat).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(side.getByText(airaCopy.malformedTitle, { exact: true })).toHaveCount(0)
  await expect(side.getByRole("textbox", { name: "Ask Aira", exact: true })).toBeFocused()
  stack.aira({ name: "turn.sse" })
  await page.keyboard.type("Suggest a title")
  await page.keyboard.press("Enter")
  await expect(side.getByText("Lead with the claim. Then show the evidence.", { exact: true })).toBeVisible()
})

test("a malformed ending leaves focus alone when the person was not in the composer", async ({
  page,
  context,
  stack,
}) => {
  const { side } = await openDeck(page, context, stack)
  let open = () => {}
  const gate = new Promise<void>((resolve) => {
    open = resolve
  })
  await page.route(
    (url) => url.pathname === "/aira/turn",
    async (route) => {
      await gate
      await route.fulfill({ status: 400, json: { ok: false, refusal: "body" } })
    },
    { times: 1 },
  )
  await ask(page, asked)
  const field = side.getByRole("textbox", { name: airaCopy.addToRequest, exact: true })
  await field.evaluate((element) => element.blur())
  await expect(field).not.toBeFocused()
  open()
  const newChat = side.locator("[data-aira-stuck]").getByRole("button", { name: "New chat", exact: true })
  await expect(newChat).toBeVisible()
  await expect(newChat).not.toBeFocused()
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)
})
