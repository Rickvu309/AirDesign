import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { expect } from "@playwright/test"

export default async function drive({ repo, page, signIn, capture, note }) {
  const { shortcutCopy } = await import("../../../../apps/web/src/copy/shortcut-copy.ts")
  const { undoCopy } = await import("../../../../apps/web/src/copy/undo-copy.ts")
  const exportWord = shortcutCopy.gestures.export
  await signIn()
  const zip = createRequire(path.join(repo, "packages/pptx/package.json"))("@zip.js/zip.js")
  async function parts(file) {
    const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
    const found = new Map()
    for (const entry of await reader.getEntries())
      if (!entry.directory) found.set(entry.filename, Buffer.from(await entry.getData(new zip.Uint8ArrayWriter())))
    await reader.close()
    return found
  }
  const fixture = path.join(repo, "scripts/pptx-fixtures/census-updating-spm.pptx")
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const entries = page.locator("[data-slide-entry]")
  await expect(entries).toHaveCount(26, { timeout: 60_000 })

  const diagramEntry = page.locator('[data-slide-entry="5"]')
  await diagramEntry.click()
  await expect(diagramEntry).toHaveAttribute("aria-current", "true")
  await expect(page.locator("[data-slide-paint] [data-diagram-shape]")).toHaveCount(6)
  await expect(diagramEntry.locator("[data-diagram-shape]")).toHaveCount(6)
  await capture("diagram-slide")
  note("slide 5 paints its SmartArt as 6 diagram shapes on the canvas and in its thumbnail")

  const chartEntry = page.locator('[data-slide-entry="19"]')
  await chartEntry.click()
  await expect(chartEntry).toHaveAttribute("aria-current", "true")
  const frames = page.locator("[data-slide-paint] [data-unshown-label]")
  await expect(frames).toHaveCount(3)
  await expect(page.locator("[data-slide-paint] svg[data-chart]")).toHaveCount(0)
  const evidence = path.dirname(await capture("chart-slide"))
  await chartEntry.click()
  await page.keyboard.press("ControlOrMeta+d")
  await expect(entries).toHaveCount(27)
  const copy = page.locator('[data-slide-entry="20"]')
  await expect(copy).toHaveAttribute("aria-current", "true")
  await expect(copy).toBeFocused()
  await expect(frames).toHaveCount(3)
  note("Ctrl+D on slide 19 made slide 20, current and focused, painting the same 3 labelled boxes")

  await chartEntry.click()
  await page.keyboard.press("Delete")
  await expect(entries).toHaveCount(26)
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.delete })).toBeEnabled()
  await expect(frames).toHaveCount(3)
  await capture("chart-slide-deleted")
  await page.keyboard.press("ControlOrMeta+z")
  await expect(entries).toHaveCount(27)
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect(entries).toHaveCount(26)
  note("deleting slide 19 left its copy current with the boxes; undo brought it back and redo deleted it again")

  const original = await parts(fixture)
  const saving = page.waitForEvent("download")
  await page.getByRole("button", { name: exportWord, exact: true }).click()
  await expect(page.getByRole("dialog", { name: exportWord }).getByRole("button", { name: exportWord })).toBeFocused()
  await page.keyboard.press("Enter")
  const file = path.join(evidence, "exported.pptx")
  await (await saving).saveAs(file)
  const exported = await parts(file)
  const charts = [...original.keys()].filter((name) => /^ppt\/(charts|embeddings)\//.test(name))
  expect(charts.length).toBeGreaterThan(0)
  expect(charts.filter((name) => !exported.get(name)?.equals(original.get(name)))).toEqual([])
  const slides = [...exported.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
  expect(slides).toHaveLength(26)
  const rels = [...exported.keys()].filter((name) => name.startsWith("ppt/slides/_rels/"))
  const naming = rels.filter((name) => exported.get(name).toString().includes("charts/chart"))
  expect(naming.length).toBeGreaterThanOrEqual(2)
  note(
    `exported ${String(slides.length)} slides; all ${String(charts.length)} chart and embedding parts are byte for byte the original's; slide rels naming a chart: ${naming.join(", ")}`,
  )
}
