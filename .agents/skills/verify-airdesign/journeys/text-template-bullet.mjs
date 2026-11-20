import { bulletOf, tabbedToTemplateBullet } from "../look/template-bullet.mjs"
import path from "node:path"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

export default async function drive(kit) {
  const { page, repo, expect, capture, note } = kit
  const { shortcutCopy } = createRequire(import.meta.url)(path.join(repo, "apps/web/src/copy/shortcut-copy.ts"))
  const exportWord = shortcutCopy.gestures.export
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const item = await tabbedToTemplateBullet(kit)
  await expect.poll(() => bulletOf(item("Arc Jet Case Study"))).toBe('"–"')
  expect(await bulletOf(item("Why Convolutional Neural Networks?"))).toBe('"•"')
  await capture("tabbed-to-second-level-dash")
  await page.keyboard.press("Tab")
  await expect(item("Arc Jet Case Study")).toHaveAttribute("data-level", "2")
  await expect.poll(() => bulletOf(item("Arc Jet Case Study"))).toBe('"•"')
  await page.keyboard.press("Shift+Tab")
  await expect.poll(() => bulletOf(item("Arc Jet Case Study"))).toBe('"–"')
  await page.keyboard.press("Escape")
  const file = path.join(path.dirname(await capture("before-export")), "text-template-bullet.pptx")
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: exportWord, exact: true }).click()
  await page.getByRole("dialog", { name: exportWord }).getByRole("button", { name: exportWord, exact: true }).click()
  await (await downloading).saveAs(file)
  const parts = await pptx.readParts(await readFile(file))
  const xml = new TextDecoder().decode(parts.get("ppt/slides/slide2.xml"))
  expect(xml).toMatch(/<a:pPr lvl="1"\/><a:r>[^]*?<a:t>Arc Jet Case Study<\/a:t>/)
  const exported = pptx
    .paintReader(parts)
    .slide("ppt/slides/slide2.xml")
    .elements.find((element) => element.shape === "6")
  const bullet = exported?.text?.paragraphs.find((paragraph) =>
    paragraph.runs.some((run) => run.text === "Arc Jet Case Study"),
  )?.bullet
  expect(bullet && "char" in bullet ? bullet.char : null).toBe("–")
  note(
    `Tab on "Arc Jet Case Study" (nasa-1d-cnn slide 2) shows the template's second-level "–", a second Tab its third-level "•", Shift Tab "–" again; export writes only lvl="1" and reads back "–": ${file}`,
  )
}
