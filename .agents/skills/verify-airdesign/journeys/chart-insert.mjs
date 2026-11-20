import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { newBlankDeck } from "../bin/new-deck.mjs"

const deckOf = (url) => url.replace(/^.*\//, "")

export default async function drive(kit) {
  const { page, expect, capture, note, post, deckRoutes, aira, repo } = kit
  const { chartCopy } = await import("../../../../apps/web/src/copy/chart-copy.ts")
  const { transitionCopy } = await import("../../../../apps/web/src/copy/transition-copy.ts")
  const { airaCopy } = await import("../../../../apps/web/src/copy/aira-copy.ts")
  const { shortcutCopy } = await import("../../../../apps/web/src/copy/shortcut-copy.ts")
  const exportWord = shortcutCopy.gestures.export
  const zip = createRequire(path.join(repo, "packages/pptx/package.json"))("@zip.js/zip.js")
  const charts = async (file) => {
    const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
    const found = []
    for (const entry of await reader.getEntries())
      if (/^ppt\/charts\/chart\d+\.xml$/.test(entry.filename))
        found.push(new TextDecoder().decode(await entry.getData(new zip.Uint8ArrayWriter())))
    await reader.close()
    return found
  }
  const { cookie } = await kit.signIn()
  await page.goto("/")
  await newBlankDeck(page)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = deckOf(page.url())
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const saved = async () => (await post(deckRoutes.open, { deck }, cookie)).json
  const canvas = page.locator("[data-slide-paint]")
  const painted = canvas.locator("svg[data-chart]")

  await page.getByRole("button", { name: chartCopy.tool, exact: true }).click()
  await capture("chart-menu")
  await page.getByRole("button", { name: chartCopy.kinds.bar, exact: true }).click()
  await expect(painted).toHaveCount(1)
  await expect(painted).toHaveAttribute("data-chart", /^column$/)
  const frame = canvas
    .locator("[data-canvas-element]")
    .filter({ has: page.locator("svg[data-chart]") })
    .first()
  await expect(page.locator("[data-selection]")).toHaveCount(1)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const data = page.locator("[data-chart-data]")
  await expect(data).toBeVisible()
  await capture("data-panel")

  const name = data.getByRole("textbox", { name: chartCopy.series(1), exact: true })
  await name.fill("Revenue")
  await name.press("Enter")
  const first = data.getByRole("textbox", { name: chartCopy.value(1, 1), exact: true })
  await first.fill("7.5")
  await first.press("Enter")
  await data.getByRole("button", { name: chartCopy.types.line, exact: true }).click()
  await expect(painted).toHaveAttribute("data-chart", "line")
  await expect(canvas.locator("[data-chart-text]").filter({ hasText: "Revenue" })).toHaveCount(1)
  await expect(frame).not.toContainText("{")
  await expect
    .poll(async () => JSON.stringify((await saved()).register), { timeout: 30_000 })
    .toContain('\\"kind\\":\\"line\\"')
  await capture("line-edited")

  const before = await frame.boundingBox()
  const left = -200 * (before.width / 480)
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
  await page.mouse.down()
  await page.mouse.move(before.x + before.width / 2 + left, before.y + before.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => Math.round((await frame.boundingBox()).x)).toBeLessThan(Math.round(before.x + left / 2))
  await capture("moved")

  await page.reload()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await expect(painted).toHaveAttribute("data-chart", "line")
  await expect(frame).not.toContainText("{")
  const moved = await frame.boundingBox()
  expect(Math.abs(moved.x - (before.x + left))).toBeLessThan(4)
  await page.mouse.click(moved.x + moved.width / 2, moved.y + moved.height / 2)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await expect(data.getByRole("textbox", { name: chartCopy.series(1), exact: true })).toHaveValue("Revenue")
  await capture("reloaded")

  const base = Number((await saved()).revision)
  const slide = (await saved()).register.index?.slides?.[0]?.id ?? "256"
  aira([{ name: "add-chart.sse", fill: { deck, base: String(base), slide } }, { name: "charted.sse" }])
  await page.getByRole("button", { name: "Agent", exact: true }).click()
  await page.getByRole("textbox", { name: airaCopy.askAira }).fill("Add a bar chart of revenue by region")
  await page.keyboard.press("Enter")
  await expect(painted).toHaveCount(2, { timeout: 30_000 })
  const added = (await saved()).register.order.filter((command) => command.slide === "element-add")
  expect(added.map((command) => [command.element.kind, command.runId === undefined ? "person" : "agent"])).toEqual([
    ["chart", "person"],
    ["chart", "agent"],
  ])
  await capture("aira-chart")

  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: exportWord, exact: true }).click()
  await page.getByRole("dialog", { name: exportWord }).getByRole("button", { name: exportWord, exact: true }).click()
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "chart-insert.pptx")
  await (await downloading).saveAs(exported)
  const xml = await charts(exported)
  expect(xml).toHaveLength(2)
  expect(
    xml.some((each) => each.includes("<c:lineChart>") && each.includes("Revenue") && each.includes("<c:v>7.5</c:v>")),
  ).toBe(true)
  expect(xml.some((each) => each.includes("<c:barChart>") && each.includes("Americas"))).toBe(true)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(exported)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deckOf(page.url()))
  await expect(painted).toHaveCount(2)
  await capture("reimported")
  note(
    `Insert chart, then Bar chart, put a column chart on the slide, selected, with its Data grid in the Design panel. Renaming Series 1 to Revenue, typing 7.5 in its first row and choosing Line repainted it as a line chart, and the server held the line value. A drag moved it to the slide's left half; after a reload it stayed there as a line chart and the grid still read Revenue. Aira's recorded edit_deck add of kind chart (one path with a person's insert) put a bar chart of three regions in the box it asked for, the right half. The export wrote both as native charts (lineChart with Revenue and 7.5, barChart with Americas) and opened again with both painted (${exported}).`,
  )
}
