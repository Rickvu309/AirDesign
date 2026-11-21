import { airaCopy, undoCopy } from "../bin/product-copy.mjs"
import path from "node:path"
import { expect } from "@playwright/test"

const node = "256.2"
const asked = "Change the title to Hello from Aira"
const failedNothing =
  "Aira's reply didn't come through. Nothing in your deck changed. Check your connection and try again."

function lastText(register) {
  const rows = register?.elements?.[node]?.landed ?? []
  const last = rows.filter((row) => row.visible && row.property !== "box").at(-1)
  if (last === undefined) return null
  return JSON.parse(last.value)
    .map((paragraph) => paragraph.runs.map((run) => run.text).join(""))
    .join("\n")
}

export default async function drive(kit) {
  const { repo, page, signIn, post, capture, note, deckRoutes, mcpRoutes, aira, holdReply, failReply } = kit
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
  const { release } = await holdReply(mcpRoutes.mcp)
  await composer.fill(asked)
  await capture("typed")
  await page.keyboard.press("Enter")
  await expect(log.getByText(asked, { exact: true })).toBeVisible()
  await expect(log.getByText("I will change the title on the first slide.", { exact: true })).toBeVisible()
  await expect(log.locator('[data-tool-state="working"]')).toHaveText("Editing slides")
  await expect(side.getByRole("button", { name: "Stop" })).toBeVisible()
  await expect(side.getByRole("textbox", { name: "Add to your request" })).toBeVisible()
  await capture("working")
  note(
    "typed the ask and pressed Enter; the reply streamed and the Editing slides step waits on /mcp with Stop showing",
  )

  await release()
  await expect(editor).toHaveText("Hello from Aira")
  await expect(log.getByText("The title now reads Hello from Aira.", { exact: true })).toBeVisible()
  await expect(log.locator('[data-tool-state="done"]')).toHaveText("Edited slides")
  await expect(side.getByRole("button", { name: undoCopy.undo })).toBeVisible()
  expect(lastText((await post(deckRoutes.open, { deck }, cookie)).json.register)).toBe("Hello from Aira")
  await capture("done")
  note(
    "the call went through /mcp, the slide and its thumbnail painted Hello from Aira without a reload, and the server copy agrees",
  )

  await side.getByRole("button", { name: "Weekly usage" }).click()
  const usage = page.getByRole("dialog", { name: "Weekly usage" })
  await expect(usage).toContainText(/\d+%/)
  await capture("usage")
  note(`the usage readout reads: ${(await usage.innerText()).replace(/\s+/g, " ")}`)
  await side.getByRole("button", { name: "Weekly usage" }).click()

  const restoreUndo = await failReply(deckRoutes.undo)
  await side.getByRole("button", { name: undoCopy.undo }).click()
  await expect(side.getByText(airaCopy.undoFailed, { exact: true })).toBeVisible()
  await expect(side.getByRole("button", { name: undoCopy.undo })).toBeEnabled()
  await expect(editor).toHaveText("Hello from Aira")
  await capture("undo-failed")
  note("an Undo that could not reach the server says so, keeps Aira's change on the slide, and offers Undo again")
  await restoreUndo()

  await side.getByRole("button", { name: undoCopy.undo }).click()
  await expect(editor).toHaveText("Hello")
  await expect(side.getByRole("button", { name: undoCopy.undo })).toHaveCount(0)
  await expect(side.getByText(airaCopy.undone, { exact: true })).toBeVisible()
  expect(lastText((await post(deckRoutes.open, { deck }, cookie)).json.register)).not.toBe("Hello from Aira")
  expect(await page.evaluate(() => document.body.dataset.sameLoad)).toBe("yes")
  await capture("undone")
  note(
    "Undo took the run back: the slide reads Hello again in the same page load, the server copy agrees, and the request says its changes are undone",
  )

  aira([{ name: "overloaded.sse" }])
  await composer.fill("Make the title bigger")
  await page.keyboard.press("Enter")
  await expect(log.getByText("Unable to finish your request", { exact: true })).toBeVisible()
  await expect(log.getByText(failedNothing, { exact: true })).toBeVisible()
  await expect(side.getByRole("button", { name: "Try again" })).toBeVisible()
  await capture("failed")
  note("an overloaded model call shows the failed card")
}
