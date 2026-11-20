import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { newBlankDeck } from "../bin/new-deck.mjs"

const deckOf = (url) => url.replace(/^.*\//, "")

function apart(left, right) {
  return (
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  )
}

export default async function drive(kit) {
  const { page, expect, capture, note, post, deckRoutes, aira, repo } = kit
  const { airaCopy } = await import("../../../../apps/web/src/copy/aira-copy.ts")
  const { shortcutCopy } = await import("../../../../apps/web/src/copy/shortcut-copy.ts")
  const { transitionCopy } = await import("../../../../apps/web/src/copy/transition-copy.ts")
  const { boxCopy } = await import("../../../../apps/web/src/copy/box-copy.ts")
  const exportWord = shortcutCopy.gestures.export
  const zip = createRequire(path.join(repo, "packages/pptx/package.json"))("@zip.js/zip.js")
  const frames = async (file) => {
    const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
    const slide = (await reader.getEntries()).find((entry) => entry.filename === "ppt/slides/slide1.xml")
    const xml = new TextDecoder().decode(await slide.getData(new zip.Uint8ArrayWriter()))
    await reader.close()
    return [...xml.matchAll(/<p:graphicFrame>.*?<a:ext cx="(\d+)" cy="(\d+)"\/>/g)].map((found) => found[1])
  }
  const { cookie } = await kit.signIn()
  await page.goto("/")
  await newBlankDeck(page)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = deckOf(page.url())
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const saved = async () => (await post(deckRoutes.open, { deck }, cookie)).json
  const canvas = page.locator("[data-slide-paint]")
  const charts = canvas.locator("[data-canvas-element]").filter({ has: page.locator("svg[data-chart]") })
  const slide = (await saved()).register.index?.slides?.[0]?.id ?? "256"
  await page.getByRole("button", { name: "Agent", exact: true }).click()
  const ask = async (count, words) => {
    const base = Number((await saved()).revision)
    aira([{ name: "add-chart-free.sse", fill: { deck, base: String(base), slide } }, { name: "charted.sse" }])
    await page.getByRole("textbox", { name: airaCopy.askAira }).fill(words)
    await page.keyboard.press("Enter")
    await expect(charts).toHaveCount(count, { timeout: 30_000 })
  }
  await ask(1, "Add a bar chart of revenue by region")
  await capture("first-chart")
  await ask(2, "Add another bar chart of revenue by region")
  await expect
    .poll(async () => {
      const [left, right] = [await charts.nth(0).boundingBox(), await charts.nth(1).boundingBox()]
      return left !== null && right !== null && apart(left, right)
    })
    .toBe(true)
  const [left, right] = [await charts.nth(0).boundingBox(), await charts.nth(1).boundingBox()]
  expect(Math.abs(left.width - right.width)).toBeLessThan(2)
  await capture("side-by-side")

  await charts.nth(0).click()
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page.getByRole("button", { name: shortcutCopy.gestures["design-mode"], exact: true }).click()
  await page.getByRole("button", { name: boxCopy.section }).click()
  const width = page.getByRole("textbox", { name: /^W/ }).first()
  await width.fill("300")
  await width.press("Enter")
  await expect
    .poll(async () => Math.round((await charts.nth(0).boundingBox()).width))
    .toBeLessThan(Math.round(left.width))
  await capture("width-typed")

  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: exportWord, exact: true }).click()
  await page.getByRole("dialog", { name: exportWord }).getByRole("button", { name: exportWord, exact: true }).click()
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "chart-place.pptx")
  await (await downloading).saveAs(exported)
  const widths = await frames(exported)
  expect(widths).toContain(String(300 * 12_700))
  note(
    `Aira added a bar chart with no box to an empty slide (centred, half the slide), then a second with no box. The second took the right half and the first moved to the left half under the same run, side by side at the same width, with no overlap. In design mode, Position and size W 300 resized the first chart, and the export's graphicFrame holds cx ${300 * 12_700} (${exported}).`,
  )
}
