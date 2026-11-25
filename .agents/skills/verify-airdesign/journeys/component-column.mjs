import { execFileSync } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { PNG } from "pngjs"
import { packageBuild } from "../../../../scripts/package-build.mjs"
import { exportCopy, productCopy } from "../bin/product-copy.mjs"
import { clickSlide, landNodes, openDoomDeck, readDoom } from "../look/doom-deck.mjs"

const rows = [
  { id: "opening", label: "Q1", value: 4.1 },
  { id: "decline", label: "Q2", value: -1.37 },
  { id: "recovery", label: "Q3", value: 2.94 },
  { id: "close", label: "Q4", value: 3.26 },
]
const title = "Change in operating profit, $M"
const positiveLabel = "Growth from established business lines"
const negativeLabel = "Decline from contracts that did not renew"

function checkBars(expect, screenshot, tree, colorOf) {
  const { data, width, height } = PNG.sync.read(screenshot)
  for (const {
    key,
    props: { box },
  } of tree.children.filter(({ key }) => key[0] === "bar")) {
    const x = Math.round(((tree.props.box.x + box.x + box.w / 2) * width) / 1920)
    const y = Math.round(((tree.props.box.y + box.y + box.h / 2) * height) / 1080)
    const at = (y * width + x) * 4
    const actual = data.slice(at, at + 3)
    const hex = colorOf(key[1])
    const expected = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))
    expect(
      Math.max(...expected.map((channel, i) => Math.abs(channel - actual[i]))),
      `${key[1]}: ${[...actual].join(", ")}`,
    ).toBeLessThan(12)
  }
}

export default async function drive(kit) {
  for (const theme of ["consulting", "editorial", "midnight", "neutral", "technical"]) {
    await driveColumn(kit, { theme, focus: [] })
    await driveColumn(kit, { theme, focus: ["decline"] })
  }
  await driveColumn(kit, { theme: "consulting", signed: true, focus: [] })
}

async function driveColumn(kit, { theme: themeId, signed = false, focus }) {
  const { page, repo, expect, note } = kit
  const doom = await packageBuild(repo, "@airdesign/doom")
  const { expandComponent, columnComponent } = await packageBuild(repo, "@airdesign/doom", "component/index.js")
  const { FontMetrics } = await packageBuild(repo, "@airdesign/api", "platform/font-metrics.js")
  const { FontSource } = await packageBuild(repo, "@airdesign/api", "platform/font-source.js")

  const theme = { ...doom.themeLibrary[themeId].theme, fonts: { heading: "Geist", body: "Geist" } }
  const widths = await new FontMetrics(new FontSource(undefined)).widths({
    faces: [false, true].map((bold) => ({ font: theme.fonts.body, bold, italic: false })),
    texts: [title, positiveLabel, negativeLabel, "0123456789.−", ...rows.map(({ label }) => label)],
  })
  expect(typeof widths).toBe("object")
  expect(widths.pending.size).toBe(0)
  const measure = doom.measureWith(widths.widths)

  const tree = expandComponent(columnComponent, {
    data: { rows },
    focus,
    frame: { x: 520, y: 180, w: 880, h: 720 },
    tokens: { title, positiveLabel, negativeLabel },
    variant: { legend: signed, signed },
    theme,
    measure,
  })
  expect(doom.isRefusal(tree), JSON.stringify(tree)).toBe(false)
  expect(tree.findings).toEqual([])
  const legend = tree.children.filter(({ key }) => key[0] === "legend-label")
  expect(legend).toHaveLength(signed ? 2 : 0)
  if (signed) {
    expect(legend[0].props.box.y).toBeLessThan(legend[1].props.box.y)
    for (const {
      props: { box, text },
    } of legend) {
      expect(measure(text, theme, null).w).toBeLessThanOrEqual(box.w)
    }
  }

  await page.addInitScript(() => {
    window.print = () => {}
  })
  const opened = await openDoomDeck(kit)
  await clickSlide(page, 50, 50)
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Delete")
  await expect
    .poll(async () =>
      Object.values((await readDoom(kit, opened)).fold.nodes).filter((node) => node.parent?.id === opened.slide),
    )
    .toHaveLength(0)
  const before = (await readDoom(kit, opened)).fold
  const root = Object.values(before.nodes).find(({ parent }) => parent == null)
  const themed = await kit.post(
    kit.doomRoutes.edit,
    {
      deck: opened.deck,
      edit: {
        once: "column-consulting-theme",
        author: { kind: "person", id: "other-tab" },
        writes: [{ node: root.id, prop: "theme", value: theme }],
      },
    },
    opened.cookie,
  )
  expect(themed.json.ok).toBe(true)
  await landNodes(kit, opened, [tree, ...tree.children.map((child) => ({ ...child, parent: tree.id }))])
  const saved = (await readDoom(kit, opened)).fold
  const thumb = page.locator("[data-slide-thumb]").first()
  for (const child of tree.children) {
    expect(saved.nodes[child.id]).toMatchObject(child.props)
    await expect(thumb.locator(`[data-node="${child.id}"]`)).toBeAttached()
  }

  await page.keyboard.press("Escape")
  await page.evaluate(() => document.fonts.ready)
  const stage = signed ? "signed" : focus.length ? "focus" : "plain"
  const name = `column-${themeId}-${stage}`
  const colorOf = (id) => {
    if (signed) return theme.colors[id === "decline" ? "negative" : "positive"]
    if (!focus.length || focus.includes(id)) return theme.colors.accent1
    const bar = tree.children.find(({ key }) => key[0] === "bar" && key[1] === id)
    return doom.resolveColor(bar.props.fills[0].color, theme)
  }
  const overview = await kit.capture(name)
  const evidence = dirname(overview)
  await writeFile(join(evidence, `${name}-tree.json`), JSON.stringify(tree, null, 2))
  const canvas = await page.locator("[data-slide-box]").screenshot({ path: join(evidence, `${name}-canvas.png`) })
  const filmstrip = await thumb.screenshot({ path: join(evidence, `${name}-filmstrip.png`) })
  checkBars(expect, canvas, tree, colorOf)
  checkBars(expect, filmstrip, tree, colorOf)
  await page.getByRole("button", { name: productCopy.exportDeck, exact: true }).click()
  await page
    .getByRole("dialog", { name: exportCopy.title })
    .getByRole("button", { name: exportCopy.action, exact: true })
    .click()
  const printedPage = page.locator("[data-print-page]")
  await expect(printedPage).toHaveCount(1)
  const expectedText = [
    ...rows.map(({ label }) => label),
    ...(signed ? [positiveLabel, negativeLabel] : []),
    "4.1",
    "−1.4",
    "2.9",
    "3.3",
  ]
  for (const text of expectedText) await expect(printedPage).toContainText(text)
  await page.emulateMedia({ media: "print" })
  checkBars(expect, await printedPage.screenshot(), tree, colorOf)
  const pdf = await page.pdf({ preferCSSPageSize: true })
  await page.emulateMedia({ media: null })
  const { pdfPages } = await import("../../../../tests/browser/pdf-file.ts")
  const pages = pdfPages(pdf)
  expect(pages.map(({ box }) => box)).toEqual([[0, 0, 960, 540]])
  expect(pages[0].content).toMatch(/\bTj\b|\bTJ\b/)
  const file = join(evidence, `${name}.pdf`)
  await writeFile(file, pdf)
  if (process.env.AIRDESIGN_COLUMN_POPPLER === "1") {
    const printed = execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" })
    for (const text of expectedText) expect(printed).toContain(text)
    const raster = join(evidence, `${name}-pdf`)
    execFileSync("pdftoppm", ["-singlefile", "-r", "144", "-png", file, raster])
    checkBars(expect, await readFile(`${raster}.png`), tree, colorOf)
  }
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")))
  note(`${name}: saved marks, canvas, filmstrip, and exported PDF checked.`)
}
