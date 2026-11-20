import { selectedWordWeight } from "../look/weight-selection.mjs"
import path from "node:path"
import { pathToFileURL } from "node:url"

export default async function drive(kit) {
  const { page, repo, expect, capture, note } = kit
  const { boldWeight, styleName } = await import(pathToFileURL(path.join(repo, "packages/fonts/dist/index.js")).href)
  const bold = styleName({ weight: boldWeight, italic: false })
  const { text, shows, pick, listed, weight, canvas, textCopy } = await selectedWordWeight(kit)
  const runs = text.locator("[data-run]")
  const words = await text.evaluate(() => getSelection()?.toString().trim() ?? "")
  await capture("selected-word-shows-semibold")
  await page.keyboard.press("ControlOrMeta+End")
  await page.keyboard.press("Shift+ControlOrMeta+ArrowLeft")
  await shows(textCopy.regular)
  await page.keyboard.press("ControlOrMeta+a")
  await expect(weight).toHaveText(/Mixed/)
  await capture("whole-title-mixed")
  await page.keyboard.press("ControlOrMeta+Home")
  await page.keyboard.press("Shift+ControlOrMeta+ArrowRight")
  await shows("SemiBold")
  await pick(bold)
  await expect(runs.first()).toHaveText(new RegExp(`^${words}`))
  await expect(runs.first()).toHaveCSS("font-weight", "700")
  await expect(runs.last()).toHaveCSS("font-weight", "400")
  await shows(bold)
  await capture("bold-picked-for-selected-word")
  await page.keyboard.press("Escape")
  await expect(weight).toHaveText(/Mixed/)
  await pick("SemiBold")
  await shows("SemiBold")
  const run = canvas.locator("[data-run]").first()
  await listed("Montserrat")
  await shows("SemiBold")
  await expect(run).toHaveCSS("font-family", /Montserrat SemiBold/)
  await capture("montserrat-from-list-keeps-semibold")
  await listed("Abel")
  await expect(weight).toHaveText(new RegExp(`^${textCopy.regular}\\W*$`), { timeout: 15_000 })
  await expect(run).toHaveCSS("font-family", /^"?Abel"?,/)
  await capture("abel-from-list-falls-back-to-regular")
  note(
    `While typing, Weight shows the selected words: "${words}" SemiBold, the rest Regular, the whole title Mixed; Bold picked with "${words}" selected bolds only those words. Montserrat picked from the Fonts list before its faces load keeps SemiBold; Abel, which has only Regular, falls back to Regular once its faces load.`,
  )
}
