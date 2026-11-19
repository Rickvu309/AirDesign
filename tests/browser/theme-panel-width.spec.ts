import { productCopy } from "../../apps/web/src/copy/product-copy"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { appearanceCopy } from "../../apps/web/src/copy/appearance-copy"
import { expect, test, type Page } from "@playwright/test"
import { colorWords } from "./color-words"
import { openDeck, setPanelMode, unfoldAll } from "./design-panel"

test.use({ viewport: { width: 1470, height: 923 } })

test("template colors stay named and reachable at narrow editor widths", async ({ page }) => {
  await openDeck(page, "clean.pptx")
  const names = await colorWords("clean.pptx")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  for (const width of [220, 240, 440]) {
    const resize = page.getByRole("separator")
    await resize.focus()
    await resize.press("Home")
    for (let at = 220; at < width; at += 10) await resize.press("ArrowLeft")
    await page.getByRole("button", { name: designCopy.editTemplateStyle, exact: true }).click()
    const dialog = page.locator("[data-template-style-dialog]")
    for (const slot of ["dk1", "accent1", "accent6"] as const) {
      const name = names[slot] ?? ""
      const swatch = dialog.getByRole("button", { name, exact: true })
      await expect(swatch).toBeVisible()
      await expect(swatch).toHaveAttribute("title", new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    }
    await dialog.getByRole("button", { name: productCopy.close, exact: true }).click()
  }
})

test("the Border preset glyphs render at the segment size", async ({ page }) => {
  await openDeck(page, "shapes-added.pptx")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await page
    .locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]')
    .click({ position: { x: 4, y: 4 } })
  const sizes = await page
    .getByRole("group", { name: appearanceCopy.border, exact: true })
    .locator("svg")
    .evaluateAll((icons) => icons.map((icon) => icon.getBoundingClientRect().width))
  expect(sizes).toEqual([16, 16, 16, 16])
})

const element = (number: number) => `[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#${number}"]`

async function choose(page: Page, elements: readonly number[]): Promise<void> {
  await page.keyboard.press("Escape")
  await page.locator("[data-slide-paint]").click({ position: { x: 4, y: 4 } })
  for (const [index, number] of elements.entries()) {
    const box = await page.locator(element(number)).boundingBox()
    if (box === null) throw new Error(`no element ${number}`)
    await page.mouse.click(box.x + Math.min(4, box.width / 2), box.y + Math.min(4, box.height / 2), {
      modifiers: index === 0 ? [] : ["Shift"],
    })
  }
}

async function chooseText(page: Page): Promise<void> {
  await page.locator('[data-slide-paint] [contenteditable="true"]').first().click()
  await page.keyboard.press("Escape")
}

async function resize(page: Page, width: number): Promise<void> {
  const separator = page.getByRole("separator")
  await separator.focus()
  await separator.press("Home")
  for (let at = 220; at < width; at += 10) await separator.press("ArrowLeft")
  await expect(separator).toHaveAttribute("aria-valuenow", String(width))
}

function clipped(page: Page): Promise<string[]> {
  return page.locator("[data-design-panel]").evaluate((panel) => {
    const edge = panel.getBoundingClientRect()
    const name = (node: Element) =>
      `${node.tagName.toLowerCase()} "${(node.getAttribute("aria-label") ?? node.textContent ?? "").trim().slice(0, 40)}"`
    const found: string[] = []
    for (const node of panel.querySelectorAll("*")) {
      const box = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      const unseen =
        box.width <= 1 ||
        box.height <= 1 ||
        node.closest("svg, [aria-hidden='true']") !== null ||
        style.visibility === "hidden" ||
        style.opacity === "0" ||
        style.clip.startsWith("rect")
      if (unseen) continue
      if (box.left < edge.left - 0.5 || box.right > edge.right + 0.5) found.push(`${name(node)} leaves the panel`)
      const cuts =
        node instanceof HTMLInputElement || (style.overflowX !== "visible" && style.textOverflow !== "ellipsis")
      if (
        cuts &&
        node.scrollWidth > node.clientWidth + 1 &&
        (node.textContent ?? "").trim() + ((node as HTMLInputElement).value ?? "") !== ""
      )
        found.push(`${name(node)} cuts its ${node instanceof HTMLInputElement ? `value "${node.value}"` : "text"}`)
    }
    return found
  })
}

const panels = [
  { kind: "text", fixture: "clean.pptx", pick: chooseText },
  { kind: "slide", fixture: "clean.pptx", pick: (page: Page) => choose(page, []) },
  { kind: "shape", fixture: "shapes-added.pptx", pick: (page: Page) => choose(page, [4]) },
  { kind: "line", fixture: "shapes-added.pptx", pick: (page: Page) => choose(page, [6]) },
  { kind: "several", fixture: "shapes-added.pptx", pick: (page: Page) => choose(page, [4, 5]) },
  { kind: "picture", fixture: "picture-png.pptx", pick: (page: Page) => choose(page, [4]) },
] as const

for (const fixture of [...new Set(panels.map((panel) => panel.fixture))])
  test(`every Design panel of ${fixture} fits at 220, 240 and 440 px with nothing clipped`, async ({ page }) => {
    await openDeck(page, fixture)
    await page.getByRole("button", { name: "Design", exact: true }).click()
    const found: string[] = []
    for (const { kind, pick } of panels.filter((panel) => panel.fixture === fixture))
      for (const mode of ["slides", "design"] as const) {
        await setPanelMode(page, mode)
        await pick(page)
        await expect(page.locator("[data-design-panel]")).toBeVisible()
        if (mode === "design") await unfoldAll(page.locator("[data-design-panel]"))
        for (const width of [220, 240, 440]) {
          await resize(page, width)
          found.push(...(await clipped(page)).map((fault) => `${kind}, ${mode} mode, ${width} px: ${fault}`))
        }
      }
    expect(found).toEqual([])
  })
