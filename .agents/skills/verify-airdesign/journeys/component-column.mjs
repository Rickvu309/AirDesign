import { execFileSync } from "node:child_process"
import { writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
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

export default async function drive(kit) {
  const { page, repo, expect, note } = kit
  const doom = await packageBuild(repo, "@airdesign/doom")
  const { expandComponent, columnComponent } = await packageBuild(repo, "@airdesign/doom", "component/index.js")
  const { FontMetrics } = await packageBuild(repo, "@airdesign/api", "platform/font-metrics.js")
  const { FontSource } = await packageBuild(repo, "@airdesign/api", "platform/font-source.js")

  const theme = { ...doom.themeLibrary.consulting.theme, fonts: { heading: "Geist", body: "Geist" } }
  const widths = await new FontMetrics(new FontSource(undefined)).widths({
    faces: [false, true].map((bold) => ({ font: theme.fonts.body, bold, italic: false })),
    texts: [title, positiveLabel, negativeLabel, "0123456789.−", ...rows.map(({ label }) => label)],
  })
  expect(typeof widths).toBe("object")
  expect(widths.pending.size).toBe(0)
  const measure = doom.measureWith(widths.widths)

  const hasLegend = Object.hasOwn(columnComponent.variants, "legend")
  const signed = Object.hasOwn(columnComponent.variants, "signed")
  const tree = expandComponent(columnComponent, {
    data: { rows },
    frame: { x: 520, y: 180, w: 880, h: 720 },
    tokens: { title, ...(hasLegend ? { positiveLabel, negativeLabel } : {}) },
    variant: hasLegend ? { legend: true, ...(signed ? { signed: true } : {}) } : {},
    theme,
    measure,
  })
  expect(doom.isRefusal(tree), JSON.stringify(tree)).toBe(false)
  expect(tree.findings).toEqual([])
  const legend = tree.children.filter(({ key }) => key[0] === "legend-label")
  expect(legend).toHaveLength(hasLegend ? 2 : 0)
  if (hasLegend) {
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
  const overview = await kit.capture("column")
  const evidence = dirname(overview)
  await writeFile(join(evidence, "tree.json"), JSON.stringify(tree, null, 2))
  await page.locator("[data-slide-box]").screenshot({ path: join(evidence, "canvas.png") })
  await thumb.screenshot({ path: join(evidence, "filmstrip.png") })
  await page.getByRole("button", { name: productCopy.exportDeck, exact: true }).click()
  await page
    .getByRole("dialog", { name: exportCopy.title })
    .getByRole("button", { name: exportCopy.action, exact: true })
    .click()
  const printedPage = page.locator("[data-print-page]")
  await expect(printedPage).toHaveCount(1)
  const expectedText = [
    ...rows.map(({ label }) => label),
    ...(hasLegend ? [positiveLabel, negativeLabel] : []),
    ...(signed ? ["4.1", "−1.4", "2.9", "3.3"] : hasLegend ? ["4.10", "−1.37", "2.94", "3.26"] : ["4", "−1", "3", "3"]),
  ]
  for (const text of expectedText) await expect(printedPage).toContainText(text)
  const pdf = await page.pdf({ preferCSSPageSize: true })
  const { pdfPages } = await import("../../../../tests/browser/pdf-file.ts")
  const pages = pdfPages(pdf)
  expect(pages.map(({ box }) => box)).toEqual([[0, 0, 960, 540]])
  expect(pages[0].content).toMatch(/\bTj\b|\bTJ\b/)
  const file = join(evidence, "column.pdf")
  await writeFile(file, pdf)
  if (process.env.AIRDESIGN_COLUMN_POPPLER === "1") {
    const printed = execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" })
    for (const text of expectedText) expect(printed).toContain(text)
    execFileSync("pdftoppm", ["-singlefile", "-r", "144", "-png", file, join(evidence, "pdf")])
  }
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")))
  note("Saved values and legend checked on the canvas, filmstrip, and exported PDF.")
}
