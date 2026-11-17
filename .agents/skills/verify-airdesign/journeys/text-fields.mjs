import path from "node:path"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

export default async function drive(kit) {
  const { page, repo, expect, capture, post, deckRoutes, note } = kit
  const require = createRequire(import.meta.url)
  const { textCopy, textWords } = require(path.join(repo, "apps/web/src/copy/text-copy.ts"))
  const { formatCopy } = require(path.join(repo, "apps/web/src/copy/format-copy.ts"))
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const document = await import(pathToFileURL(path.join(repo, "packages/document/dist/index.js")).href)
  const signed = await kit.signIn()
  for (const feature of ["strike", "letter-spacing", "numbers"]) {
    await page.goto("/")
    await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
    await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
    const deck = page.url().split("/").at(-1)
    await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
    await page.getByRole("button", { name: "Design", exact: true }).click()
    const canvas = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
    await canvas.click({ position: { x: 4, y: 4 } })
    const panel = page.locator("[data-design-element]")
    const node = await panel.getAttribute("data-design-element")
    await capture(`${feature}-before`)
    if (feature === "strike") {
      await panel.getByRole("button", { name: formatCopy.named.strike, exact: true }).click()
      await expect(canvas.locator("[data-run]").first()).toHaveCSS("text-decoration-line", "line-through")
    } else if (feature === "letter-spacing") {
      const field = panel.getByRole("textbox", { name: textCopy.letterSpacing, exact: true })
      await field.fill("-2")
      await field.press("Enter")
      await expect(field).toHaveValue("-2")
    } else {
      await panel.getByRole("button", { name: textWords["list.numbers"], exact: true }).click()
      await canvas.dblclick()
      const editor = canvas.locator('[contenteditable="true"]')
      await editor.press("End")
      await editor.press("Enter")
      await page.keyboard.type("Second")
      await expect(editor.locator("[data-paragraph]")).toHaveCount(2)
      await expect
        .poll(() =>
          editor
            .locator("[data-paragraph]")
            .last()
            .evaluate((paragraph) => getComputedStyle(paragraph, "::before").content),
        )
        .toBe('"2."')
      await editor.press("Escape")
    }
    await capture(`${feature}-painted`)
    const expected =
      feature === "strike" ? '"strike":true' : feature === "letter-spacing" ? '"letterSpacing":-64' : '"list":"numbers"'
    await expect
      .poll(async () => {
        const server = (await post(deckRoutes.open, { deck }, signed.cookie)).json.register
        return document.currentValue(server.elements[node])
      })
      .toContain(expected)
    await page.reload()
    await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
    await capture(`${feature}-reloaded`)
    const downloading = page.waitForEvent("download")
    await page.getByRole("button", { name: "Export", exact: true }).click()
    await page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export", exact: true }).click()
    const file = path.join(path.dirname(await capture(`${feature}-exported`)), `${feature}.pptx`)
    await (await downloading).saveAs(file)
    const parts = await pptx.readParts(await readFile(file))
    const xml = new TextDecoder().decode(parts.get("ppt/slides/slide1.xml"))
    expect(xml).toContain(
      feature === "strike"
        ? 'strike="sngStrike"'
        : feature === "letter-spacing"
          ? 'spc="-64"'
          : '<a:buAutoNum type="arabicPeriod"/>',
    )
    note(`${feature}: panel, canvas, server row, reload and native export verified; ${file}`)
  }
}
