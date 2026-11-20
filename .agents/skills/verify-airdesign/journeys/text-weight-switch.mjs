import { openDeck } from "../look/open-deck.mjs"
import path from "node:path"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

export default async function drive(kit) {
  const { page, repo, expect, capture, note } = kit
  const require = createRequire(import.meta.url)
  const { textCopy } = require(path.join(repo, "apps/web/src/copy/text-copy.ts"))
  const { shortcutCopy } = require(path.join(repo, "apps/web/src/copy/shortcut-copy.ts"))
  const { transitionCopy } = require(path.join(repo, "apps/web/src/copy/transition-copy.ts"))
  const exportWord = shortcutCopy.gestures.export
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  await kit.signIn()
  const fixture = path.join(repo, "scripts/pptx-fixtures/doe-heat-pumps.pptx")
  await page.goto(kit.origin)
  await openDeck(page, fixture)
  const deck = path.posix.basename(new URL(page.url()).pathname)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const canvas = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
  await canvas.click({ position: { x: 4, y: 4 } })
  const panel = page.locator("[data-design-element]")
  const font = panel.getByRole("textbox", { name: textCopy.font, exact: true })
  const weight = panel.getByRole("combobox", { name: textCopy.weight, exact: true })
  const shows = (name) => expect(weight).toHaveText(new RegExp(`^${name}\\W*$`))
  const run = canvas.locator("[data-run]").first()
  const family = async (name) => {
    const manifest = page.waitForResponse((response) => response.url().includes(`family=${name}`))
    await font.fill(name)
    await manifest
    await font.press("Enter")
  }
  await family("Inter")
  await weight.click()
  await page.getByRole("option", { name: "SemiBold", exact: true }).click()
  await shows("SemiBold")
  await family("Montserrat")
  await shows("SemiBold")
  await expect(run).toHaveCSS("font-family", /Montserrat SemiBold/)
  await capture("montserrat-keeps-semibold")
  await family("Abel")
  await shows(textCopy.regular)
  await expect(run).toHaveCSS("font-family", /^"?Abel/)
  await capture("abel-falls-back-to-regular")
  await font.fill("Inter")
  await font.press("Enter")
  await shows(textCopy.regular)
  await canvas.dblclick()
  const text = canvas.locator('[contenteditable="true"]')
  await expect(text).toBeFocused()
  await page.keyboard.press("ControlOrMeta+Home")
  await page.keyboard.press("Shift+ControlOrMeta+ArrowRight")
  const words = await text.evaluate(() => getSelection()?.toString().trim() ?? "")
  await page.keyboard.press("Control+Alt+Shift+Period")
  await page.keyboard.press("Control+Alt+Shift+Period")
  const runs = text.locator("[data-run]")
  await expect(runs.first()).toHaveText(new RegExp(`^${words}`))
  await expect(runs.first()).toHaveCSS("font-family", /Inter SemiBold/)
  await expect(runs.last()).not.toHaveCSS("font-family", /SemiBold/)
  await capture("first-word-semibold-while-typing")
  await page.keyboard.press("Escape")
  const file = path.join(path.dirname(await capture("before-export")), "text-weight-switch.pptx")
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: exportWord, exact: true }).click()
  await page.getByRole("dialog", { name: exportWord }).getByRole("button", { name: exportWord, exact: true }).click()
  await (await downloading).saveAs(file)
  const parts = await pptx.readParts(await readFile(file))
  const xml = new TextDecoder().decode(parts.get("ppt/slides/slide1.xml"))
  expect(xml).toContain('typeface="Inter SemiBold"')
  expect(xml).toContain('typeface="Inter"')
  note(
    `Inter SemiBold → Montserrat keeps SemiBold, → Abel falls back to Regular; while typing, the weight keys step "${words}" to Inter SemiBold and leave the rest Inter; export writes both: ${file}`,
  )
}
