import path from "node:path"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

export default async function drive(kit) {
  const { repo, page, expect, post, deckRoutes, capture, note } = kit
  const require = createRequire(import.meta.url)
  const { appearanceCopy: designCopy } = require(path.join(repo, "apps/web/src/copy/appearance-copy.ts"))
  const { lineWords } = require(path.join(repo, "apps/web/src/copy/line-copy.ts"))
  const { effectsWords } = require(path.join(repo, "apps/web/src/copy/effects-copy.ts"))
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
    ["border", [...["none", "solid", "dash", "dot"].map((name) => [name, lineWords[`border.${name}`]])]],
    [
      "shadow",
      [
        ...["subtle", "medium", "strong"].map((name) => [name, effectsWords[`shadow.${name}`]]),
        ["none", lineWords["border.none"]],
      ],
    ],
  ]) {
    for (const [name, label] of choices) {
      const group = kind === "border" ? border : shadow
      await group.getByRole("button", { name: label, exact: true }).click()
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
        const line = pptx.shownLine(parts, at)
        if (name === "none") expect(line.fill.value).toEqual({ none: true })
        else {
          expect(line.fill.value).toHaveProperty("solid")
          expect(line.dash.value).toBe(name)
        }
      } else {
        const effects = pptx.shownEffects(parts, at)
        expect(effects.shadow.value).toHaveProperty(name === "none" ? "none" : "outer")
      }
      note(`Saved and exported ${kind} ${name}: ${file}`)
    }
  }
  const resize = page.getByRole("separator", { name: "Resize panel" })
  for (const [key, width] of [
    ["Home", 220],
    ["End", 440],
    ["Home", 220],
  ]) {
    await resize.focus()
    await resize.press(key)
    await expect(page.locator("[data-editor-panel]")).toHaveJSProperty("clientWidth", width - 1)
    await capture(`panel-${width}`)
  }
  await resize.dblclick()
  await expect(resize).toHaveAttribute("aria-valuenow", "240")
  await capture("panel-240")
}
