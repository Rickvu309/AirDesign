import { openDeck } from "../look/open-deck.mjs"
import path from "node:path"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { PNG } from "pngjs"

export default async function drive(kit) {
  const { page, repo, expect, capture, note } = kit
  const require = createRequire(import.meta.url)
  const { textCopy } = require(path.join(repo, "apps/web/src/copy/text-copy.ts"))
  const { shortcutCopy } = require(path.join(repo, "apps/web/src/copy/shortcut-copy.ts"))
  const { transitionCopy } = require(path.join(repo, "apps/web/src/copy/transition-copy.ts"))
  const exportWord = shortcutCopy.gestures.export
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const fonts = await import(pathToFileURL(path.join(repo, "packages/fonts/dist/index.js")).href)
  const styles = fonts
    .familyStyles([
      { style: "normal", weight: "100 900" },
      { style: "italic", weight: "100 900" },
    ])
    .map(fonts.styleName)
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
  await font.fill("Inter")
  await font.press("Enter")
  const run = canvas.locator("[data-run]").first()
  await expect(run).toHaveCSS("font-family", /Inter/)
  const ink = async () => {
    await page.evaluate(() => document.fonts.ready)
    const png = PNG.sync.read(await run.screenshot({ animations: "disabled" }))
    let dark = 0
    for (let at = 0; at < png.data.length; at += 4) if (png.data[at] < 128) dark += 1
    return dark
  }
  const weight = panel.getByRole("combobox", { name: textCopy.weight, exact: true })
  const shows = (name) => expect(weight).toHaveText(new RegExp(`^${name}\\W*$`))
  await weight.click()
  await expect(page.getByRole("option")).toHaveText(styles)
  await capture("inter-weights")
  await page.keyboard.press("Escape")
  const regular = await ink()
  await weight.click()
  await page.getByRole("option", { name: "SemiBold", exact: true }).click()
  await shows("SemiBold")
  await expect(run).toHaveCSS("font-family", /Inter SemiBold/)
  await expect.poll(ink).toBeGreaterThan(regular * 1.2)
  const semibold = await ink()
  await capture("inter-semibold")
  await canvas.click()
  await page.keyboard.press("Control+Alt+Shift+Period")
  await shows(shortcutCopy.gestures.bold)
  await page.keyboard.press("Control+Alt+Shift+Period")
  await shows("ExtraBold")
  await expect(run).toHaveCSS("font-family", /Inter ExtraBold/)
  await expect.poll(ink).toBeGreaterThan(semibold * 1.2)
  await capture("inter-extrabold-by-keys")
  note(`Inter ink: Regular ${regular}, SemiBold ${semibold}, ExtraBold ${await ink()} dark pixels`)
  const file = path.join(path.dirname(await capture("before-export")), "text-weight-faces.pptx")
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: exportWord, exact: true }).click()
  await page.getByRole("dialog", { name: exportWord }).getByRole("button", { name: exportWord, exact: true }).click()
  await (await downloading).saveAs(file)
  const parts = await pptx.readParts(await readFile(file))
  const original = await pptx.readParts(await readFile(fixture))
  const xml = new TextDecoder().decode(parts.get("ppt/slides/slide1.xml"))
  expect(xml).toContain('typeface="Inter ExtraBold"')
  const changed = [...original]
    .filter(([name, before]) => !Buffer.from(parts.get(name) ?? []).equals(Buffer.from(before)))
    .map(([name]) => name)
  expect(changed).toEqual(["ppt/slides/slide1.xml"])
  note(
    `Weight list holds all ${styles.length} Inter styles; keys step SemiBold to ExtraBold; export writes typeface "Inter ExtraBold" and changes only slide1.xml: ${file}`,
  )
}
