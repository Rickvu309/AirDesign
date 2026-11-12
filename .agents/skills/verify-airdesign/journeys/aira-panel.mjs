import path from "node:path"
import { expect } from "@playwright/test"

const node = "256.2"
const asked = "Change the title to Hello from Aira"

function lastText(register) {
  const rows = register?.elements?.[node]?.landed ?? []
  const last = rows.filter((row) => row.visible && row.property !== "box").at(-1)
  if (last === undefined) return null
  return JSON.parse(last.value)
    .map((paragraph) => paragraph.runs.map((run) => run.text).join(""))
    .join("\n")
}

export default async function drive(kit) {
  const { repo, page, signIn, post, capture, note, deckRoutes, mcpRoutes, aira } = kit
  const { cookie, email } = await signIn()
  note(`signed in as ${email} through the emailed code`)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await page.evaluate(() => {
    document.body.dataset.sameLoad = "yes"
  })
  const side = page.locator("[data-editor-panel]")
  const log = side.getByRole("log")
  const composer = side.getByRole("textbox", { name: "Ask Aira" })
  await expect(composer).toBeVisible()
  await capture("agent-panel")
  const base = (await post(deckRoutes.open, { deck }, cookie)).json.revision
  note(`imported clean.pptx as deck ${deck} at revision ${String(base)}; the Agent panel shows the Ask Aira composer`)

  aira([{ name: "edit.sse", fill: { deck, base: String(base), node } }, { name: "edited.sse" }])
  let open = () => undefined
  const gate = new Promise((resolve) => {
    open = resolve
  })
  await page.route(
    (url) => url.pathname === mcpRoutes.mcp.path,
    async (route) => {
      await gate
      await route.continue()
    },
  )
  await composer.fill(asked)
  await capture("typed")
  await page.keyboard.press("Enter")
  await expect(log.getByText(asked, { exact: true })).toBeVisible()
  await expect(log.getByText("I will change the title on the first slide.", { exact: true })).toBeVisible()
  await expect(log.locator('[data-tool-state="working"]')).toHaveText("airdesign_edit_deck")
  await expect(side.getByRole("button", { name: "Stop" })).toBeVisible()
  await expect(side.getByRole("textbox", { name: "Add to the request" })).toBeVisible()
  await capture("working")
  note(
    "typed the ask and pressed Enter; the reply streamed and the airdesign_edit_deck call waits on /mcp with Stop showing",
  )

  open()
  await expect(editor).toHaveText("Hello from Aira")
  await expect(log.getByText("The title now reads Hello from Aira.", { exact: true })).toBeVisible()
  await expect(log.locator('[data-tool-state="done"]')).toHaveText("airdesign_edit_deck")
  await expect(side.getByRole("button", { name: "Undo" })).toBeVisible()
  expect(lastText((await post(deckRoutes.open, { deck }, cookie)).json.register)).toBe("Hello from Aira")
  await capture("done")
  note(
    "the call went through /mcp, the slide and its thumbnail painted Hello from Aira without a reload, and the server copy agrees",
  )

  await side.getByRole("button", { name: "Weekly usage" }).click()
  const usage = side.getByRole("region", { name: "Weekly usage" })
  await expect(usage).toContainText(/\d+%/)
  await capture("usage")
  note(`the usage readout reads: ${(await usage.innerText()).replace(/\s+/g, " ")}`)
  await side.getByRole("button", { name: "Weekly usage" }).click()

  await side.getByRole("button", { name: "Undo" }).click()
  await expect(editor).toHaveText("Hello")
  await expect(side.getByRole("button", { name: "Undo" })).toHaveCount(0)
  expect(lastText((await post(deckRoutes.open, { deck }, cookie)).json.register)).not.toBe("Hello from Aira")
  expect(await page.evaluate(() => document.body.dataset.sameLoad)).toBe("yes")
  await capture("undone")
  note("Undo took the run back: the slide reads Hello again in the same page load and the server copy agrees")

  aira([{ name: "overloaded.sse" }])
  await composer.fill("Make the title bigger")
  await page.keyboard.press("Enter")
  await expect(log.getByText("Unable to finish this run", { exact: true })).toBeVisible()
  await expect(log.getByText("Your work so far is saved.", { exact: true })).toBeVisible()
  await capture("failed")
  note("an overloaded model call shows the failed card")
}
