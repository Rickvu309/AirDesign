import { airaCopy } from "../bin/product-copy.mjs"
import path from "node:path"
import { expect } from "@playwright/test"

export default async function drive({
  repo,
  page,
  signIn,
  post,
  capture,
  note,
  deckRoutes,
  mcpRoutes,
  airaRoutes,
  countryHeader,
  aira,
  holdReply,
}) {
  const { cookie } = await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  const side = page.locator("[data-editor-panel]")
  const log = side.getByRole("log")
  const composer = side.getByRole("textbox", { name: "Ask Aira" })
  const newChat = side.getByRole("button", { name: "New chat", exact: true })
  await expect(newChat).toBeDisabled()
  await side.getByRole("button", { name: airaCopy.chatsTitle, exact: true }).click()
  await expect(page.getByText("Your chats with Aira on this deck show here.")).toBeVisible()
  await expect(page.getByText("This device keeps your last 20 chats.")).toBeVisible()
  await capture("history-empty")
  await page.keyboard.press("Escape")
  await side.getByRole("button", { name: "Weekly usage" }).click()
  const usage = page.getByRole("dialog", { name: "Weekly usage" })
  await expect(usage).toContainText(/\d+%/)
  await expect(usage).toContainText("Resets")
  await expect(page.getByRole("link", { name: "See all usage" })).toHaveAttribute("href", "/settings/usage")
  await capture("usage-before-ask")
  await page.keyboard.press("Escape")
  note(
    "before any ask: New chat is off, the history menu says what it keeps, and the usage ring opens the week with a link to /settings/usage",
  )

  const base = (await post(deckRoutes.open, { deck }, cookie)).json.revision
  aira([{ name: "edit.sse", fill: { deck, base: String(base), node: "256.2" } }, { name: "edited.sse" }])
  const { release } = await holdReply(mcpRoutes.mcp)
  await composer.fill("Change the title to Hello from Aira")
  await page.keyboard.press("Enter")
  await expect(log.locator('[data-step-mark="progress"]')).toBeVisible()
  await side.getByRole("button", { name: "Stop" }).click()
  await capture("stopping")
  await release()
  await expect(side.getByRole("button", { name: "Stop" })).toHaveCount(0)
  await expect(composer).toBeEditable()
  await expect(log.getByText("Stopped editing slides", { exact: true })).toBeVisible()
  await expect(editor).toHaveText("Hello")
  await expect(log.getByText("The title now reads Hello from Aira.")).toHaveCount(0)
  await capture("stopped")
  const stop = await post(airaRoutes.stop, { ask: "00000000-0000-4000-8000-000000000000" }, cookie)
  expect(stop.status).toBe(200)
  const refused = await post(airaRoutes.stop, { ask: "not an id" }, cookie)
  expect(refused.status).toBe(400)
  const elsewhere = await post(airaRoutes.turn, { deck, messages: [{ role: "user", content: "Hello" }] }, cookie, {
    [countryHeader]: "CN",
  })
  expect(elsewhere.status).toBe(403)
  expect(elsewhere.json.refusal).toBe("country")
  note(
    "Stop during a held tool call ended that call, marked the step stopped, left the title as it was and asked the model nothing more; /aira/stop answers 200 for an ask id and 400 for a bad one; a turn from an unsupported country answers 403 country",
  )

  aira([{ name: "overloaded.sse" }])
  await composer.fill("Sum up this deck")
  await page.keyboard.press("Enter")
  const retry = side.getByRole("button", { name: "Try again" })
  await expect(retry).toBeVisible()
  await capture("failed")
  aira([{ name: "turn.sse" }])
  await retry.click()
  await expect(log.getByText(/Lead with the claim/)).toBeVisible()
  await capture("retried")
  note("a failed reply offered Try again, and Try again sent the ask again and showed the answer")

  await page.reload()
  await expect(log.getByText(/Lead with the claim/)).toBeVisible()
  await expect(newChat).toBeEnabled()
  await newChat.click()
  await expect(side.locator("[data-aira-welcome]")).toBeVisible()
  await capture("new-chat")
  note(
    "a reload reopened the chat from this device; New chat went back to the welcome, and the next reload reopened the last chat with answers again",
  )

  await page.route(`**${airaRoutes.usage.path}`, async (route) => {
    const answer = await route.fetch()
    await route.fulfill({ response: answer, json: { ...(await answer.json()), available: false } })
  })
  await page.reload()
  await expect(log.getByText(/Lead with the claim/)).toBeVisible()
  await newChat.click()
  await expect(side.locator("[data-aira-welcome]")).toContainText("Aira isn't available in your country or region yet.")
  await expect(side.getByRole("textbox", { name: airaCopy.unavailable })).toBeDisabled()
  await capture("not-offered")
  note("when the usage answer says Aira is not available, the welcome says so and the composer is off")
}
