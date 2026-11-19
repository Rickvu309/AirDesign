import { execFileSync } from "node:child_process"
import path from "node:path"
import { expect } from "@playwright/test"
import { frameCopy } from "../../../../apps/web/src/copy/frame-copy.ts"
import { opacityCopy } from "../../../../apps/web/src/copy/opacity-copy.ts"
import { transitionCopy } from "../../../../apps/web/src/copy/transition-copy.ts"
import { undoCopy } from "../../../../apps/web/src/copy/undo-copy.ts"

const fixture = "scripts/pptx-fixtures/frame.pptx"
const slide = "ppt/slides/slide1.xml"

export default async function drive({ page, signIn, post, capture, note, deckRoutes, repo }) {
  const { cookie } = await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, fixture))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const canvas = page.locator("[data-slide-paint]")
  const element = (shape) => canvas.locator(`[data-canvas-element="${slide}#${shape}"]`)
  const faded = canvas.locator("[data-group-effects]")
  const panel = page.locator("[data-design-panel]")
  const fills = () =>
    Promise.all([3, 4, 5].map((shape) => element(shape).evaluate((node) => getComputedStyle(node).backgroundColor)))
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await element(4).click()
  await expect(panel.getByText(frameCopy.autoFrame, { exact: true })).toBeVisible()
  const opacity = panel.getByRole("textbox", { name: opacityCopy.label, exact: true })
  await expect(opacity).toHaveValue("100")
  await expect(faded).toHaveCount(0)
  const solid = await fills()
  await capture("frame-opaque")
  await opacity.fill("50")
  await opacity.press("Enter")
  await expect(faded).toHaveCSS("opacity", "0.5")
  const held = await faded.evaluate((layer) =>
    [...layer.querySelectorAll("[data-canvas-element]")].map((each) => each.getAttribute("data-canvas-element")),
  )
  expect(held).toEqual([3, 4, 5].map((shape) => `${slide}#${shape}`))
  expect(await fills()).toEqual(solid)
  await capture("frame-faded")
  await expect
    .poll(async () => {
      const saved = (await post(deckRoutes.open, { deck }, cookie)).json
      const frame = Object.keys(saved.register.elements).find((key) => key.endsWith(".2"))
      const rows = frame === undefined ? [] : saved.register.elements[frame].landed
      return rows.map((row) => row.patch?.layout?.opacity?.set).filter((value) => value !== undefined)
    })
    .toEqual([50_000])
  await page.getByRole("button", { name: undoCopy.undoNamed.opacity, exact: true }).click()
  await expect(faded).toHaveCount(0)
  await expect(opacity).toHaveValue("100")
  await capture("opacity-undone")
  await page.getByRole("button", { name: undoCopy.redoNamed.opacity, exact: true }).click()
  await expect(faded).toHaveCSS("opacity", "0.5")
  await page.reload()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await expect(faded).toHaveCSS("opacity", "0.5")
  await capture("reloaded")
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "auto-layout-opacity.pptx")
  await (await downloading).saveAs(exported)
  const diff = execFileSync("node", ["scripts/deck-diff.mjs", path.join(repo, fixture), exported, "--allow", slide], {
    cwd: repo,
    encoding: "utf8",
  })
  expect(diff).toContain("1 changed, 0 added, 0 removed")
  for (const shape of [3, 4, 5])
    expect(diff).toContain(
      `p:grpSp[id=2]/p:sp[id=${shape}]/p:spPr/a:solidFill/a:schemeClr/a:alpha\n  + <a:alpha val="50000">`,
    )
  note(
    `frame.pptx opened as an auto layout frame; its Opacity set to 50 wrote one layout.opacity row (50000) on the frame, and the canvas painted the backdrop and both children inside one layer at CSS opacity 0.5 while each child's own fill stayed as it was. Undo opacity took the layer away and read 100; Redo and a reload brought it back. The export ${path.basename(exported)} changed only ${slide}, where the backdrop and both children now carry alpha 50000.`,
  )
}
