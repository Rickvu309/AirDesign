import { expect, type Page } from "@playwright/test"
import type { ReadDeckAnswer } from "../../packages/engine/src/index.ts"
import { forward, signInBrowser, test } from "./api-stack"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

function value(text: string): string {
  return JSON.stringify([{ from: 0, runs: [{ from: 0, text }] }])
}

function gridThumb(page: Page, number: number) {
  return page.locator(`[data-editor-grid] [data-slide-entry="${number}"]`)
}

test("a grid thumbnail repaints while the grid is open after an agent's edit, and after a person's edit", async ({
  page,
  context,
  stack,
  decks,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await decks.open()
  await page.getByRole("button", { name: "Grid" }).click()
  await expect(gridThumb(page, 1)).toBeVisible()
  const read = (await stack.callTool("airdesign_read_deck", { deck, slide: "256" }, cookie)) as ReadDeckAnswer
  const element = read.elements?.find((row) => row.node === "256.2")
  if (element === undefined) throw new Error("no text on slide 256")
  const base = (await stack.post("/decks/open", { deck }, cookie)).json.revision
  const edited = await stack.callTool(
    "airdesign_edit_deck",
    { deck, base, changes: [{ node: "256.2", readAt: element.version, value: value("Edited by an agent") }] },
    cookie,
  )
  expect(edited).toMatchObject({ ok: true })
  await expect(gridThumb(page, 1)).toContainText("Edited by an agent")
  await expect(page.locator("[data-editor-grid]")).toBeVisible()
  await page.locator('[data-editor-grid] [data-thumb-node="256.2"]').dblclick({ force: true })
  const editor = page.locator('[data-slide-paint] [contenteditable="true"]').first()
  await expect(editor).toBeFocused()
  await page.keyboard.press("ControlOrMeta+a")
  await editor.pressSequentially("Typed by a person", { delay: 20 })
  await expect(editor).toHaveText("Typed by a person")
  await page.getByRole("button", { name: "Grid" }).click()
  await expect(gridThumb(page, 1)).toContainText("Typed by a person")
})
