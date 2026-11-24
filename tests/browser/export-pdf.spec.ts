import { writeFile } from "node:fs/promises"
import { expect, type Page } from "@playwright/test"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { exportCopy } from "../../apps/web/src/copy/export-copy"
import { editorRoutes } from "../../apps/web/src/editor/editor-routes"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import * as doom from "../../packages/doom/src/index.ts"
import { test, type Stack } from "./api-stack"
import { covers } from "./gesture"
import { landNodes, landOffScreen, openEditor, savedSlides, spot, type Opened } from "./editor-deck"
import { openScreen } from "./open-screen"
import { pdfPages } from "./pdf-file"

test.use({ viewport: { width: 1600, height: 1000 } })

const dialog = (page: Page) => page.getByRole("dialog", { name: exportCopy.title })
const exportButton = (page: Page) => page.getByRole("button", { name: productCopy.exportDeck, exact: true })
const printPages = (page: Page) => page.locator("[data-print-sheet] [data-print-page]")

async function recordPrints(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const titles: string[] = []
    Object.assign(window, { printTitles: titles })
    window.print = () => {
      titles.push(document.title)
    }
  })
}

const printTitles = (page: Page) =>
  page.evaluate(() => (window as unknown as { printTitles: readonly string[] }).printTitles)

async function choose(page: Page, field: string, option: string): Promise<void> {
  await dialog(page).getByRole("combobox", { name: field }).click()
  await page.getByRole("option", { name: option, exact: true }).click()
  await expect(dialog(page).getByRole("combobox", { name: field })).toContainText(option)
}

async function deckOfSlides(page: Page, stack: Stack, opened: Opened, count: number): Promise<readonly string[]> {
  for (let made = 1; made < count; made += 1) {
    await page.getByRole("button", { name: slideListCopy.addSlide }).click()
    await expect(page.locator("[data-slide-entry]")).toHaveCount(made + 1)
  }
  await expect.poll(async () => (await savedSlides(stack, opened)).length).toBe(count)
  return savedSlides(stack, opened)
}

async function nameDeck(stack: Stack, opened: Opened, name: string): Promise<void> {
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const answer = await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)
  const deck = [...(doom.readFold(answer.json.fold)?.nodes.values() ?? [])].find((node) => !("parent" in node))
  if (deck === undefined) throw new Error("no deck")
  const edit = {
    once: "name-deck",
    author: { kind: "person", id: "other-tab" },
    writes: [{ node: deck.id, prop: "name", value: name }],
  }
  expect((await stack.post(doomRoutes.edit.path, { deck: opened.deck, edit }, opened.cookie)).json.ok).toBe(true)
}

test("Export prints every slide on its own 16:9 page under the deck's name, with real text and working links", async ({
  page,
  context,
  stack,
}) => {
  await recordPrints(page)
  const opened = await openEditor(page, context, stack)
  const slides = await deckOfSlides(page, stack, opened, 3)
  await nameDeck(stack, opened, "Q3 / Board: final")
  await landOffScreen(stack, opened, [
    {
      id: "t:7",
      type: "shape",
      parent: opened.slide,
      props: {
        box: spot(160, 700, 1200, 120),
        text: {
          chars: "Read the board pack",
          spans: [{ end: 9 }, { end: 19, link: "https://airdesign.app/board" }],
          paras: [{}],
          style: "body",
          resize: "fixed",
          alignV: "top",
        },
      },
    },
    { id: "t:8", type: "shape", parent: opened.slide, props: { box: spot(1500, 860, 200, 120), link: slides[2] } },
  ])
  await page.locator('[data-slide-entry="1"]').click()
  await expect(page.locator('[data-slide-box] [data-node="t:7"]')).toContainText("Read the board pack")

  await exportButton(page).click()
  await expect(dialog(page).getByRole("button", { name: exportCopy.action })).toBeFocused()
  await expect(dialog(page).getByRole("combobox")).toHaveCount(1)
  await expect(dialog(page).getByRole("combobox", { name: exportCopy.slides })).toContainText(exportCopy.allSlides)
  await expect(dialog(page)).toContainText(exportCopy.printWindow)
  await page.keyboard.press("Enter")

  await expect.poll(() => printTitles(page)).toEqual(["Q3 Board final"])
  await expect(dialog(page)).toHaveCount(0)
  await expect(page).toHaveTitle("Q3 Board final")
  await expect(printPages(page)).toHaveCount(3)

  const pages = pdfPages(await page.pdf({ preferCSSPageSize: true }))
  expect(pages).toHaveLength(3)
  for (const each of pages) expect(each.box).toEqual([0, 0, 960, 540])
  expect(pages[0]?.content).toMatch(/\bBT\b[\s\S]*\bT[jJ]\b/)
  expect(pages[0]?.links).toEqual(expect.arrayContaining(["https://airdesign.app/board", "page"]))
  await expect(printPages(page)).toHaveCount(0)
  await expect(page).not.toHaveTitle("Q3 Board final")
})

test("the current slide or a range prints only those slides, and a wrong range says why until it is fixed", async ({
  page,
  context,
  stack,
}) => {
  await recordPrints(page)
  const opened = await openEditor(page, context, stack)
  const slides = await deckOfSlides(page, stack, opened, 3)
  await page.locator('[data-slide-entry="2"]').click()

  await exportButton(page).click()
  await choose(page, exportCopy.slides, exportCopy.currentSlide)
  await dialog(page).getByRole("button", { name: exportCopy.action }).click()
  await expect.poll(async () => (await printTitles(page)).length).toBe(1)
  await expect(printPages(page)).toHaveCount(1)
  await expect(printPages(page)).toHaveAttribute("data-print-page", slides[1] ?? "")
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")))
  await expect(dialog(page)).toHaveCount(0)

  await exportButton(page).click()
  await choose(page, exportCopy.slides, exportCopy.range)
  const first = dialog(page).getByRole("spinbutton", { name: exportCopy.from })
  const last = dialog(page).getByRole("spinbutton", { name: exportCopy.to })
  const action = dialog(page).getByRole("button", { name: exportCopy.action })
  for (const value of ["4", "", "0"]) {
    await first.fill(value)
    await expect(first).toHaveAttribute("aria-invalid", "true")
    await expect(first).toHaveCSS("box-shadow", "none")
    await expect(first).toHaveCSS("outline-style", "solid")
    await expect(first).toHaveAccessibleDescription(exportCopy.rangeOf(3))
    await expect(action).toBeDisabled()
  }
  await first.fill("2")
  await expect(dialog(page).getByRole("alert")).toHaveCount(0)
  await last.press("Enter")
  await expect.poll(async () => (await printTitles(page)).length).toBe(2)
  await expect(printPages(page)).toHaveCount(2)
  expect(await printPages(page).evaluateAll((all) => all.map((each) => each.getAttribute("data-print-page")))).toEqual(
    slides.slice(1),
  )
})

async function recordPrintKeys(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const held: boolean[] = []
    Object.assign(window, { printKeysHeld: held })
    window.addEventListener(
      "keydown",
      (event) => {
        if (event.key.toLowerCase() === "p" && (event.ctrlKey || event.metaKey))
          setTimeout(() => held.push(event.defaultPrevented))
      },
      true,
    )
  })
}

const printKeysHeld = (page: Page) =>
  page.evaluate(() => (window as unknown as { printKeysHeld: readonly boolean[] }).printKeysHeld)

test("Ctrl or Cmd+P opens the actions bar, whose Export as PDF opens Export; the browser never prints the editor or the show", async ({
  page,
  context,
  stack,
}) => {
  covers("actions")
  await recordPrints(page)
  await recordPrintKeys(page)
  await openEditor(page, context, stack)
  const actions = page.locator("[data-actions-panel]")
  await page.keyboard.press("ControlOrMeta+p")
  await expect(actions).toBeVisible()
  await actions.getByRole("option", { name: editorCopy.exportPdf }).click()
  await expect(actions).toHaveCount(0)
  await expect(dialog(page)).toBeVisible()
  await choose(page, exportCopy.slides, exportCopy.currentSlide)
  await page.keyboard.press("ControlOrMeta+p")
  await expect(dialog(page).getByRole("combobox", { name: exportCopy.slides })).toContainText(exportCopy.currentSlide)
  await page.keyboard.press("Escape")
  await expect(dialog(page)).toHaveCount(0)

  await page.locator("[data-notes-bar] textarea").click()
  await page.keyboard.press("ControlOrMeta+p")
  await expect(actions).toHaveCount(0)

  await page.locator("[data-slide-box]").click()
  await page.keyboard.press("F5")
  await expect(page.locator("[data-present-show]")).toBeVisible()
  await page.keyboard.press("ControlOrMeta+p")
  await expect.poll(async () => (await printKeysHeld(page)).length).toBe(4)
  expect(await printKeysHeld(page)).toEqual([true, true, true, true])
  expect(await printTitles(page)).toEqual([])
})

test("Escape closes the dialog, focus returns to Export, and nothing prints", async ({ page, context, stack }) => {
  await recordPrints(page)
  await openEditor(page, context, stack)
  await exportButton(page).click()
  await expect(dialog(page)).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog(page)).toHaveCount(0)
  await expect(exportButton(page)).toBeFocused()
  await expect(printPages(page)).toHaveCount(0)
  expect(await printTitles(page)).toEqual([])
})

test("a picture that never arrives fails the export after a wait, and Try again prints once it is gone", async ({
  page,
  context,
  stack,
}) => {
  await recordPrints(page)
  await page.clock.install()
  const opened = await openEditor(page, context, stack)
  await landNodes(stack, opened, [
    {
      id: "t:9",
      type: "shape",
      parent: opened.slide,
      props: { box: spot(200, 200, 400, 300), fills: [{ kind: "image", asset: "f".repeat(64), fit: "fill" }] },
    },
  ])
  await expect(page.locator('[data-slide-box] [data-node="t:9"]')).toHaveCount(1)
  await exportButton(page).click()
  await dialog(page).getByRole("button", { name: exportCopy.action }).click()
  await expect(dialog(page).getByRole("button", { name: exportCopy.exporting })).toBeDisabled()
  await page.clock.fastForward(30_000)
  const notice = page.getByText(productCopy.exportFailed)
  await expect(notice).toBeVisible()
  await expect(dialog(page)).toHaveCount(0)
  await expect(printPages(page)).toHaveCount(0)
  expect(await printTitles(page)).toEqual([])

  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const edit = {
    once: "drop-picture",
    author: { kind: "person", id: "other-tab" },
    writes: [{ node: "t:9", prop: "parent", value: null }],
  }
  expect((await stack.post(doomRoutes.edit.path, { deck: opened.deck, edit }, opened.cookie)).json.ok).toBe(true)
  await expect(page.locator('[data-slide-box] [data-node="t:9"]')).toHaveCount(0)
  await page.getByRole("button", { name: exportCopy.tryAgain }).click()
  await expect.poll(async () => (await printTitles(page)).length).toBe(1)
  await expect(notice).toHaveCount(0)
})

test("the sample deck exports as a PDF for the poppler check @pdf", async ({ page }) => {
  await recordPrints(page)
  await openScreen(page, editorRoutes.agentComplete)
  await exportButton(page).click()
  await dialog(page).getByRole("button", { name: exportCopy.action }).click()
  await expect.poll(() => printTitles(page)).toEqual(["Annual strategy review"])
  await expect(printPages(page)).toHaveCount(7)
  const lines = await printPages(page).evaluateAll((all) =>
    all.map((each) => each.querySelector("[data-line]")?.textContent?.trim() ?? ""),
  )
  const { sampleDeckLines, sampleDeckPdf } = await import("../../scripts/pdf-sample.mjs")
  await writeFile(sampleDeckLines, JSON.stringify({ pages: lines.length, lines }))
  await writeFile(sampleDeckPdf, await page.pdf({ preferCSSPageSize: true }))
})
