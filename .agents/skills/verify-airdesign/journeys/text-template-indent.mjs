import { tabbedInTemplate } from "../look/template-indent.mjs"
import path from "node:path"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

export default async function drive(kit) {
  const { page, repo, expect, capture, note } = kit
  const { shortcutCopy } = createRequire(import.meta.url)(path.join(repo, "apps/web/src/copy/shortcut-copy.ts"))
  const exportWord = shortcutCopy.gestures.export
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const item = await tabbedInTemplate(kit)
  const pad = (word) => item(word).evaluate((node) => Number.parseFloat(getComputedStyle(node).paddingLeft))
  const second = await pad("PHCC")
  const third = await pad("NCCER")
  expect((third - second) / second).toBeCloseTo((1_143_000 - 685_800) / 685_800, 2)
  await capture("tabbed-to-template-level")
  await page.keyboard.press("Escape")
  const file = path.join(path.dirname(await capture("before-export")), "text-template-indent.pptx")
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: exportWord, exact: true }).click()
  await page.getByRole("dialog", { name: exportWord }).getByRole("button", { name: exportWord, exact: true }).click()
  await (await downloading).saveAs(file)
  const parts = await pptx.readParts(await readFile(file))
  const xml = new TextDecoder().decode(parts.get("ppt/slides/slide16.xml"))
  expect(xml).toContain('<a:p><a:pPr lvl="2"/><a:r><a:rPr lang="en-US" dirty="0"/><a:t>NCCER</a:t>')
  note(
    `Tab on NCCER (slide 16) puts it at the template's third-level indent, 1.25" (PHCC at 0.75"), and export writes only <a:pPr lvl="2"/>: ${file}`,
  )
}
