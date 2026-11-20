import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { expect } from "@playwright/test"
import { adjustToneCopy } from "../../apps/web/src/copy/adjust-tone-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { formatCopy } from "../../apps/web/src/copy/format-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { colorWords } from "./color-words"
import { fixtures, openDeck, pickColor } from "./design-panel"
import { savedExport } from "./export-dialog"
import { partsOf, shapeAt } from "./shape-fills"
import { covers } from "./gesture"
import { test } from "./deck-test"

test.use({ viewport: { width: 1600, height: 1000 } })

test("selects three matching footers, updates them while offline, and undoes each panel edit across slides", async ({
  page,
  context,
  decks,
}, testInfo) => {
  covers("select-matching")
  await openDeck(page, "clean.pptx")
  const names = await colorWords("clean.pptx")
  const footer = shapeAt(page, "2")
  const words = footer.locator("[contenteditable]")
  await words.click()
  await words.press("ControlOrMeta+A")
  await words.pressSequentially("Company footer")
  await expect(words).toHaveText("Company footer")
  const design = page.getByRole("button", { name: "Design", exact: true })
  await design.click()
  await words.press("Escape")
  const panel = page.locator("[data-design-element]")
  await expect(panel).toBeVisible()
  const matching = panel.getByRole("button", { name: designCopy.selectMatching })
  await expect(matching).toHaveCount(0)

  const entries = page.locator("[data-slide-entry]")
  for (const count of [2, 3]) {
    await entries.nth(count - 2).focus()
    await page.keyboard.press("ControlOrMeta+D")
    await expect(entries).toHaveCount(count)
  }
  await entries.first().click()
  if ((await design.getAttribute("aria-pressed")) !== "true") await design.click()
  await footer.click({ position: { x: 4, y: 4 } })
  await matching.click()
  await expect(panel).toContainText(designCopy.selected(3))
  await expect(page.locator("[data-slide-entry] [data-chosen]")).toHaveCount(2)

  await context.setOffline(true)
  const color = panel.getByRole("group", { name: formatCopy.color, exact: true })
  const paint = entries.locator("[data-text-body] [data-paragraph] > span")
  const original = await paint.first().evaluate((run) => getComputedStyle(run).color)
  await pickColor(page, color, names.accent6)
  const changed = await paint.first().evaluate((run) => getComputedStyle(run).color)
  expect(changed).not.toBe(original)
  for (const run of await paint.all()) await expect(run).toHaveCSS("color", changed)

  await panel.getByRole("button", { name: designCopy.multiEditText, exact: true }).click()
  const text = page.getByRole("textbox", { name: designCopy.multiEditText })
  await text.fill("Revised footer")
  await text.press("ControlOrMeta+Enter")
  for (const entry of await entries.all()) await expect(entry).toContainText("Revised footer")
  await page.getByRole("button", { name: undoCopy.undoNamed.text, exact: true }).click()
  for (const entry of await entries.all()) await expect(entry).toContainText("Company footer")
  await page.getByRole("button", { name: undoCopy.undoNamed.format, exact: true }).click()
  for (const run of await paint.all()) await expect(run).toHaveCSS("color", original)

  await context.setOffline(false)
  await page.reload()
  await decks.ready()
  for (const entry of await entries.all()) await expect(entry).toContainText("Company footer")
  if ((await design.getAttribute("aria-pressed")) !== "true") await design.click()
  await footer.click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("Control+Alt+A")
  await expect(panel).toContainText(designCopy.selected(3))
  const file = testInfo.outputPath("matching.pptx")
  await savedExport(page, file)
  const parts = await partsOf(file)
  const slides = [...parts].filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
  expect(slides).toHaveLength(3)
  for (const [, bytes] of slides) expect(bytes.toString()).toContain("Company footer")
})

test("replaces a picture file through the title action and keeps its frame through undo, reload and export", async ({
  page,
  decks,
}, testInfo) => {
  const { pictureCopy } = await import("../../apps/web/src/copy/picture-copy")
  await openDeck(page, "picture-png.pptx")
  const picture = shapeAt(page, "4")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await picture.click({ position: { x: 8, y: 8 } })
  const frame = await picture.boundingBox()
  const source = () =>
    picture.evaluate(async (image) => {
      const url = /^url\("([^"]+)"\)$/.exec(getComputedStyle(image).backgroundImage)?.[1]
      if (url === undefined) return null
      try {
        return (await (await fetch(url)).blob()).type
      } catch {
        return null
      }
    })
  await expect.poll(source).toBe("image/png")
  const file = join(fixtures, "picture.jpeg")
  const panel = page.locator("[data-design-element]")
  const choosing = page.waitForEvent("filechooser")
  await panel.getByRole("button", { name: pictureCopy.replace, exact: true }).click()
  await (await choosing).setFiles(file)
  await expect.poll(source).toBe("image/jpeg")
  expect(await picture.boundingBox()).toEqual(frame)
  await page.getByRole("button", { name: undoCopy.undoNamed.picture, exact: true }).click()
  await expect.poll(source).toBe("image/png")
  await page.getByRole("button", { name: undoCopy.redoNamed.picture, exact: true }).click()
  await expect.poll(source).toBe("image/jpeg")
  await page.reload()
  await decks.ready()
  await expect.poll(source).toBe("image/jpeg")
  const exported = testInfo.outputPath("replaced.pptx")
  await savedExport(page, exported)
  const parts = await partsOf(exported)
  const raster = [...parts].find(([name]) => /^ppt\/media\/picture-[a-f0-9]+\.jpeg$/.test(name))
  expect(raster?.[1]).toEqual(await readFile(file))
})

test("shows Adjust tone on an imported auto layout frame", async ({ page }) => {
  await openDeck(page, "frame.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await shapeAt(page, "4").click()
  const frame = page.locator('[data-panel-kind="frame"] [data-design-head]')
  const tone = frame.getByRole("button", { name: adjustToneCopy.title, exact: true })
  await tone.click()
  await expect(page.locator("[data-adjust-tone]")).toBeVisible()
})
