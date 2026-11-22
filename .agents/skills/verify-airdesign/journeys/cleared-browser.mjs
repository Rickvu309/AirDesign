import path from "node:path"
import { expect } from "@playwright/test"
import { clearBrowser } from "../bin/clear-browser.mjs"

const typed = "Kept on the server"

function textsIn(register) {
  return Object.values(register?.elements ?? {}).flatMap((element) => {
    const last = element.landed.filter((landed) => landed.visible && typeof landed.value === "string").at(-1)
    if (last === undefined) return []
    return [
      JSON.parse(last.value)
        .map((paragraph) => paragraph.runs.map((run) => run.text).join(""))
        .join("\n"),
    ]
  })
}

export default async function drive({ repo, page, signIn, post, capture, note, deckRoutes }) {
  const { cookie } = await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  const painted = await page.locator("[data-canvas-element]").count()
  await editor.dblclick()
  await page.keyboard.press("ControlOrMeta+a")
  await editor.pressSequentially(typed, { delay: 20 })
  await expect.poll(async () => textsIn((await post(deckRoutes.open, { deck }, cookie)).json.register)).toEqual([typed])
  note(`deck ${deck} paints ${String(painted)} elements and the server reads "${typed}"`)
  await expect.poll(async () => (await post(deckRoutes.original, { deck }, cookie)).json.ok).toBe(true)
  note(`the server keeps the original file of deck ${deck}`)
  const deckUrl = page.url()
  await page.goto("/version")
  await clearBrowser(page)
  await page.goto(deckUrl)
  await capture("reopened-cleared")
  await expect(page.locator('[contenteditable="true"]')).toHaveText(typed)
  await expect(page.locator("[data-canvas-element]")).toHaveCount(painted)
  await capture("reopened-painted")
  note("after clearing IndexedDB, local storage and site files, the reopened slide shows its text and every element")
}
