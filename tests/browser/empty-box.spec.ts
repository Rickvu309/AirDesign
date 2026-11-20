import { join } from "node:path"
import { expect } from "@playwright/test"
import { decksOn, test } from "./deck-test"
import { stored } from "./device-store"
import { savedExport } from "./export-dialog.ts"
import { changedParts, partsOf, shapeIn } from "./thin-deck-parts.ts"

const fixtures = join(process.cwd(), "scripts/pptx-fixtures")

test("an empty box reached from the text before it takes typed text, keeps it after reload and exports it", async ({
  page,
}, testInfo) => {
  const deck = join(fixtures, "doe-heat-pumps.pptx")
  const download = testInfo.outputPath("empty-box.pptx")
  const part = "ppt/slides/slide1.xml"
  await decksOn(page).open(deck)
  const empty = page.locator("[contenteditable]").nth(2)
  await expect(empty).toHaveAttribute("contenteditable", "true")
  await expect(empty).toHaveText("")
  await page.locator("[contenteditable]").nth(1).focus()
  await page.keyboard.press("Escape")
  await page.keyboard.press("Tab")
  await page.keyboard.press("Enter")
  await expect(empty).toBeFocused()
  await empty.pressSequentially("Typed here", { delay: 50 })
  await stored(page, "Typed here")
  await page.reload()
  await decksOn(page).ready()
  await expect(page.locator("[contenteditable]").nth(2)).toHaveText("Typed here")
  await savedExport(page, download)
  expect(await changedParts(deck, download)).toEqual([part])
  const before = (await partsOf(deck)).get(part)?.toString("utf8") ?? ""
  const after = (await partsOf(download)).get(part)?.toString("utf8") ?? ""
  const written = shapeIn(after, "4")
  expect(after.replace(written, "")).toBe(before.replace(shapeIn(before, "4"), ""))
  expect(written).toContain("<a:t>Typed here</a:t>")
})
