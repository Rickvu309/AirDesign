import { expect } from "@playwright/test"
import { forward, openClean, signInBrowser, test } from "./api-stack"

const node = "256.2"

function value(text: string): string {
  return JSON.stringify([{ from: 0, runs: [{ from: 0, text }] }])
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("an outside agent's edit and its undo paint in the open editor without a reload", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openClean(page)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await page.evaluate(() => {
    document.body.dataset.sameLoad = "yes"
  })
  const base = (await stack.post("/decks/open", { deck }, cookie)).json.revision
  const edited = await stack.callTool(
    "airdesign_edit_deck",
    { deck, base, changes: [{ node, readAt: 0, value: value("Hello from an agent") }] },
    cookie,
  )
  expect(edited).toMatchObject({ ok: true })
  await expect(editor).toHaveText("Hello from an agent")
  const undone = await stack.post("/decks/undo", { deck, runId: edited.runId }, cookie)
  expect(undone.json).toMatchObject({ ok: true, deck })
  await expect(editor).toHaveText("Hello")
  expect(await page.evaluate(() => document.body.dataset.sameLoad)).toBe("yes")
})

test("the person's typing stays on screen while an agent edits the deck", async ({ page, context, stack }) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  const asked = await forward(page, stack)
  const deck = await openClean(page)
  const editor = page.locator('[contenteditable="true"]')
  await editor.click()
  await page.keyboard.press("ControlOrMeta+a")
  await editor.pressSequentially("Typed by me", { delay: 50 })
  await expect.poll(() => asked.filter((path) => path === "/decks/commit").length).toBeGreaterThan(0)
  const base = (await stack.post("/decks/open", { deck }, cookie)).json.revision
  const refused = await stack.callTool(
    "airdesign_edit_deck",
    { deck, base, changes: [{ node, readAt: 0, value: value("Hello from an agent") }] },
    cookie,
  )
  expect(refused.ok).toBe(false)
  await editor.pressSequentially("!", { delay: 50 })
  await expect(editor).toHaveText("Typed by me!")
  expect(asked.filter((path) => path === "/decks/open")).toHaveLength(1)
})
