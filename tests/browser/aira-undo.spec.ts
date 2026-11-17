import { expect } from "@playwright/test"
import { deckRoutes } from "@airdesign/catalog"
import { airaCopy } from "../../apps/web/src/copy/aira-copy.ts"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import { forward, openClean, signInBrowser, test } from "./api-stack"

const node = "256.2"
const asked = "Change the title to Hello from Aira"

test.use({ viewport: { width: 1600, height: 1000 }, locale: "en-US", timezoneId: "Asia/Ho_Chi_Minh" })

test("an Undo that cannot reach the server says so and keeps Undo, and the next Undo takes the run back", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openClean(page)
  const opened = deckRoutes.open.result((await stack.post(deckRoutes.open.path, { deck }, cookie)).json)
  expect(opened.ok).toBe(true)
  if (!opened.ok) return
  const base = opened.revision
  const side = page.locator("[data-editor-panel]")
  const log = side.getByRole("log")
  stack.aira({ name: "edit.sse", fill: { deck, base: String(base), node } }, { name: "edited.sse" })
  await side.getByRole("textbox", { name: airaCopy.askAira }).fill(asked)
  await page.keyboard.press("Enter")
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello from Aira")
  await page.route(`**${deckRoutes.undo.path}`, (route) => route.abort())
  const undo = side.getByRole("button", { name: productCopy.undo, exact: true })
  await undo.click()
  await expect(log.getByText(airaCopy.undoFailed, { exact: true })).toBeVisible()
  await expect(undo).toBeEnabled()
  await expect(editor).toHaveText("Hello from Aira")
  const kept = await stack.post(deckRoutes.open.path, { deck }, cookie)
  expect(JSON.stringify(kept.json)).toContain("Hello from Aira")
  await page.unroute(`**${deckRoutes.undo.path}`)
  await undo.click()
  await expect(editor).toHaveText("Hello")
  await expect(log.getByText(airaCopy.undoFailed, { exact: true })).toHaveCount(0)
  await expect(log.getByText(airaCopy.undone, { exact: true })).toBeVisible()
})
