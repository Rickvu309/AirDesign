import path from "node:path"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { shortcutCopy, transitionCopy } from "../bin/product-copy.mjs"
import { fixtureDeck } from "../look/fixture-deck.mjs"

export default async function drive(kit) {
  const { page, repo, expect, capture, note } = kit
  const { textCopy } = createRequire(import.meta.url)(path.join(repo, "apps/web/src/copy/text-copy.ts"))
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const exportWord = shortcutCopy.gestures.export
  await fixtureDeck(kit)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page
    .locator("[data-slide-paint] [data-canvas-element]")
    .first()
    .click({ position: { x: 4, y: 4 } })
  const panel = page.locator("[data-design-element]")
  const line = panel.getByRole("textbox", { name: textCopy.lineHeight, exact: true })
  const letters = panel.getByRole("textbox", { name: textCopy.letterSpacing, exact: true })
  await expect(line).toHaveValue(textCopy.auto)
  for (const [typed, shown] of [
    ["150%", "150"],
    ["24pt", "62.5"],
    [textCopy.auto, textCopy.auto],
    ["120 %", "120"],
  ]) {
    await line.fill(typed)
    await line.press("Enter")
    await expect(line).toHaveValue(shown)
  }
  await letters.fill("2pt")
  await letters.press("Enter")
  await expect(letters).toHaveValue("6.25")
  await capture("typed-units")
  const file = path.join(path.dirname(await capture("before-export")), "text-spacing-units.pptx")
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: exportWord, exact: true }).click()
  await page.getByRole("dialog", { name: exportWord }).getByRole("button", { name: exportWord, exact: true }).click()
  await (await downloading).saveAs(file)
  const parts = await pptx.readParts(await readFile(file))
  const xml = new TextDecoder().decode(parts.get("ppt/slides/slide1.xml"))
  expect(xml).toContain('<a:lnSpc><a:spcPct val="120000"/></a:lnSpc>')
  expect(xml).toContain('spc="200"')
  note(
    `Line height reads 150%, 24pt (62.5% at 32 pt type), Auto and 120 %; letter spacing 2pt is 6.25%; export writes lnSpc 120% and spc 200: ${file}`,
  )
}
