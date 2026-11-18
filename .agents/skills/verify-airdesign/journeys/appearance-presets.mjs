import path from "node:path"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

export default async function drive(kit) {
  const { repo, page, expect, post, deckRoutes, capture, note } = kit
  const require = createRequire(import.meta.url)
  const { appearanceCopy: designCopy } = require(path.join(repo, "apps/web/src/copy/appearance-copy.ts"))
  const { borderCopy, borderWords } = require(path.join(repo, "apps/web/src/copy/border-copy.ts"))
  const { effectsWords } = require(path.join(repo, "apps/web/src/copy/effects-copy.ts"))
  const { opacityCopy } = require(path.join(repo, "apps/web/src/copy/opacity-copy.ts"))
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const signed = await kit.signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/shapes-added.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await page
    .locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]')
    .click({ position: { x: 4, y: 4 } })
  const panel = page.locator("[data-design-element]")
  const border = panel.getByRole("group", { name: designCopy.border, exact: true })
  const shadow = panel.getByRole("group", { name: designCopy.shadowPreset, exact: true })
  const at = { part: "ppt/slides/slide1.xml", shape: "4" }
  for (const [kind, choices] of [
    ["border", [...["none", "solid", "dash", "dot"].map((name) => [name, borderWords[`border.${name}`]])]],
    [
      "shadow",
      [
        ...["subtle", "medium", "strong"].map((name) => [name, effectsWords[`shadow.${name}`]]),
        ["none", borderWords["border.none"]],
      ],
    ],
  ]) {
    for (const [name, label] of choices) {
      const group = kind === "border" ? border : shadow
      await group.getByRole("button", { name: label, exact: true }).click()
      if (kind === "border" && name !== "none") {
        const borderSection = panel.locator(`[data-design-section="${designCopy.border}"]`)
        await expect(borderSection.getByText(borderCopy.color, { exact: true })).toBeVisible()
        await expect(borderSection.getByRole("textbox", { name: borderCopy.width, exact: true })).toBeVisible()
      }
      if (kind === "border" && name === "none") {
        await expect(
          panel
            .locator(`[data-design-section="${designCopy.border}"]`)
            .getByRole("textbox", { name: borderCopy.width, exact: true }),
        ).toHaveCount(0)
      }
      await expect(group.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true")
      await capture(`${kind}-${name}`)
      await expect
        .poll(async () => {
          const server = (await post(deckRoutes.open, { deck }, signed.cookie)).json.register
          const element = server.elements[await panel.getAttribute("data-design-element")]
          return JSON.stringify(element.landed.at(-1)?.patch)
        })
        .toContain(
          name === "none"
            ? '"none":true'
            : kind === "border"
              ? `"dash":{"set":"${name}"}`
              : `"distance":${{ subtle: 12700, medium: 25400, strong: 50800 }[name]}`,
        )
      const downloading = page.waitForEvent("download")
      await page.getByRole("button", { name: "Export", exact: true }).click()
      await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
      await page.keyboard.press("Enter")
      const file = path.join(path.dirname(await capture(`export-${kind}-${name}`)), `${kind}-${name}.pptx`)
      await (await downloading).saveAs(file)
      const parts = await pptx.readParts(await readFile(file))
      if (kind === "border") {
        const border = pptx.shownBorder(parts, at)
        if (name === "none") expect(border.fill.value).toEqual({ none: true })
        else {
          expect(border.fill.value).toHaveProperty("solid")
          expect(border.dash.value).toBe(name)
        }
      } else {
        const effects = pptx.shownEffects(parts, at)
        expect(effects.shadow.value).toHaveProperty(name === "none" ? "none" : "outer")
      }
      note(`Saved and exported ${kind} ${name}: ${file}`)
    }
  }
  await expect(panel.getByRole("button", { name: designCopy.list(opacityCopy.label), exact: true })).toBeVisible()
  await shadow.getByRole("button", { name: effectsWords["shadow.subtle"], exact: true }).click()
  const slider = panel.getByRole("slider", { name: opacityCopy.slider, exact: true })
  await expect(slider).toBeVisible()
  await slider.fill("40")
  await expect
    .poll(async () => {
      const server = (await post(deckRoutes.open, { deck }, signed.cookie)).json.register
      const element = server.elements[await panel.getAttribute("data-design-element")]
      return JSON.stringify(element.landed.at(-1)?.patch)
    })
    .toContain('"val":40000')
  await expect(shadow.getByRole("button", { name: effectsWords["shadow.subtle"], exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await shadow.getByRole("button", { name: borderWords["border.none"], exact: true }).click()
  await expect(slider).toHaveCount(0)
  const resize = page.getByRole("separator", { name: designCopy.resizePanel })
  for (const width of [220, 440, 240]) {
    await resize.focus()
    await resize.press("Home")
    for (let current = 220; current < width; current += 10) await resize.press("ArrowLeft")
    await expect(page.locator("[data-editor-panel]")).toHaveJSProperty("clientWidth", width - 1)
    await capture(`panel-${width}`)
  }
  await resize.dblclick()
  await expect(resize).toHaveAttribute("aria-valuenow", "240")
  await capture("panel-240")
}
