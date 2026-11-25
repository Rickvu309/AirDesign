import { writeFile } from "node:fs/promises"
import { expect, type Page } from "@playwright/test"
import { PNG } from "pngjs"
import { exportCopy } from "../../apps/web/src/copy/export-copy"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import * as doom from "../../packages/doom/src/index.ts"
import { test, type Stack } from "./api-stack"
import { landNodes, openEditor, type Opened } from "./editor-deck"
import { pdfPages } from "./pdf-file"
import { parityNodes } from "./path-parity-scene"
import { differences, measure, parityFaults, type Picture } from "./path-parity-score"

test.use({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })

async function emptySlide(stack: Stack, opened: Opened): Promise<void> {
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const answer = await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)
  const fold = doom.readFold(answer.json.fold)
  const writes = [...(fold?.nodes.values() ?? [])]
    .filter((node) => "parent" in node && node.parent?.id === opened.slide)
    .map((node) => ({ node: node.id, prop: "parent", value: null }))
  const edit = { once: "empty-slide", author: { kind: "person", id: "other-tab" }, writes }
  expect((await stack.post(doomRoutes.edit.path, { deck: opened.deck, edit }, opened.cookie)).json.ok).toBe(true)
  await expect(opened.page.locator("[data-slide-box] [data-node]")).toHaveCount(0)
}

async function paintScene(page: Page, stack: Stack, opened: Opened): Promise<void> {
  await emptySlide(stack, opened)
  const nodes = parityNodes().map((node) => (node.parent === "" ? { ...node, parent: opened.slide } : node))
  await landNodes(stack, opened, nodes)
  const last = nodes.at(-1)?.id ?? ""
  await expect(page.locator(`[data-slide-entry="1"] [data-slide-thumb] [data-node="${last}"]`).first()).toBeAttached()
  await page.mouse.move(0, 0)
}

const picture = (png: Buffer): Picture => PNG.sync.read(png)

test("wedges, rings, near-full sweeps, polylines and dashes paint on the filmstrip as on the canvas", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  await paintScene(page, stack, opened)
  const canvas = picture(await page.locator("[data-slide-box]").screenshot())
  const thumb = picture(await page.locator('[data-slide-entry="1"] [data-slide-thumb]').screenshot())
  const wanted = measure(canvas)
  expect([
    ...parityFaults("canvas", wanted, wanted, undefined, { highlight: 4.2, varying: 4.5 }),
    ...parityFaults("filmstrip", measure(thumb), wanted, differences(thumb, canvas), { highlight: 16, varying: 16 }),
  ]).toEqual([])
})

test("the path scene exports as a PDF beside its canvas for the poppler check @pdf", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  await paintScene(page, stack, opened)
  const canvas = await page.locator("[data-slide-box]").screenshot()
  await page.evaluate(() => {
    window.print = () => {}
  })
  await page.getByRole("button", { name: productCopy.exportDeck, exact: true }).click()
  await page.getByRole("dialog", { name: exportCopy.title }).getByRole("button", { name: exportCopy.action }).click()
  await expect(page.locator("[data-print-page]")).toHaveCount(1)
  const pdf = await page.pdf({ preferCSSPageSize: true })
  expect(pdfPages(pdf).map(({ box }) => box)).toEqual([[0, 0, 960, 540]])
  const { pathParityCanvas, pathParityPdf } = await import("../../scripts/pdf-sample.mjs")
  await writeFile(pathParityCanvas, canvas)
  await writeFile(pathParityPdf, pdf)
})
