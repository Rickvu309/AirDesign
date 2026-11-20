import path from "node:path"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { shortcutCopy, transitionCopy } from "../bin/product-copy.mjs"
import { nestedList } from "../look/text-list-levels.mjs"

export default async function drive(kit) {
  const { page, repo, expect, capture, note } = kit
  const { textWords } = createRequire(import.meta.url)(path.join(repo, "apps/web/src/copy/text-copy.ts"))
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const exportWord = shortcutCopy.gestures.export
  const items = await nestedList(kit)
  const indents = () =>
    items.evaluateAll((all) => all.map((item) => Number.parseFloat(getComputedStyle(item).paddingLeft)))
  const [first, second, third] = await indents()
  expect(second).toBeGreaterThan(first)
  expect(third).toBeGreaterThan(second)
  await capture("bullets-by-level")
  await items.nth(2).click()
  await page.keyboard.press("Shift+Tab")
  await expect(items.nth(2)).toHaveAttribute("data-level", "1")
  await page.keyboard.press("ControlOrMeta+BracketRight")
  await expect(items.nth(2)).toHaveAttribute("data-level", "2")
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page.getByRole("button", { name: textWords["list.numbers"], exact: true }).click()
  const painted = page.locator("[data-slide-paint] [data-paragraph]")
  await expect
    .poll(() => painted.evaluateAll((all) => all.map((item) => item.style.getPropertyValue("--bullet"))))
    .toEqual(['"1."', '"a."', '"i."'])
  await capture("numbers-by-level")
  const thumb = page.locator("[data-thumb-paint] [data-paragraph]")
  await expect
    .poll(() => thumb.evaluateAll((all) => all.map((item) => item.style.getPropertyValue("--bullet"))))
    .toEqual(['"1."', '"a."', '"i."'])
  const file = path.join(path.dirname(await capture("before-export")), "text-list-levels.pptx")
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: exportWord, exact: true }).click()
  await page.getByRole("dialog", { name: exportWord }).getByRole("button", { name: exportWord, exact: true }).click()
  await (await downloading).saveAs(file)
  const parts = await pptx.readParts(await readFile(file))
  const xml = new TextDecoder().decode(parts.get("ppt/slides/slide1.xml"))
  expect(xml).toContain('<a:pPr marL="457200" indent="-457200"><a:buAutoNum type="arabicPeriod"/>')
  expect(xml).toContain('<a:pPr marL="914400" lvl="1" indent="-457200"><a:buAutoNum type="alphaLcPeriod"/>')
  expect(xml).toContain('<a:pPr marL="1371600" lvl="2" indent="-457200"><a:buAutoNum type="romanLcPeriod"/>')
  note(
    `Tab, Shift Tab and Mod ] set levels 0, 1, 2; numbers read 1. a. i. on the slide and its thumbnail; export writes lvl with marL and indent per level: ${file}`,
  )
}
