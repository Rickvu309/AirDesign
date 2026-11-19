import path from "node:path"
import { expect } from "@playwright/test"

const slide = "ppt/slides/slide1.xml"
const fixture = "scripts/pptx-fixtures/frame.pptx"

export default async function drive({ page, signIn, post, capture, note, deckRoutes, repo, aira }) {
  const { frameCopy, layoutWords } = await import("../../../../apps/web/src/copy/frame-copy.ts")
  const { transitionCopy } = await import("../../../../apps/web/src/copy/transition-copy.ts")
  const { undoCopy } = await import("../../../../apps/web/src/copy/undo-copy.ts")
  const { airaCopy } = await import("../../../../apps/web/src/copy/aira-copy.ts")
  const { cookie } = await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, fixture))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const canvas = page.locator("[data-slide-paint]")
  const element = (shape) => canvas.locator(`[data-canvas-element="${slide}#${shape}"]`)
  const saved = async () => (await post(deckRoutes.open, { deck }, cookie)).json
  const boxOf = async (shape) => {
    const box = await element(shape).boundingBox()
    if (box === null) throw new Error(`no shape ${shape}`)
    return box
  }
  const stacked = async () => (await boxOf(5)).y >= (await boxOf(4)).y + (await boxOf(4)).height - 1
  const inRow = async () => Math.abs((await boxOf(5)).y - (await boxOf(4)).y) <= 1.5

  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const mode = page.locator("[data-design-mode]")
  if ((await mode.getAttribute("aria-pressed")) !== "true") await mode.click()
  await expect(mode).toHaveAttribute("aria-pressed", "true")
  await element(4).click()
  const panel = page.locator("[data-design-panel]")
  await expect(panel.getByText(frameCopy.autoFrame, { exact: true })).toBeVisible()
  const direction = panel.getByRole("group", { name: frameCopy.flow })
  await expect(direction.getByRole("button", { name: layoutWords["flow.horizontal"] })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await capture("auto-layout-section")
  await direction.getByRole("button", { name: layoutWords["flow.vertical"] }).click()
  await expect.poll(stacked).toBe(true)
  await capture("made-vertical")

  const frame = `${(await saved()).register.index?.slides?.[0]?.id ?? "256"}.2`
  const base = Number((await saved()).revision)
  aira([{ name: "frame-layout.sse", fill: { deck, base: String(base), frame } }, { name: "edited.sse" }])
  await page.getByRole("button", { name: "Agent", exact: true }).click()
  await page
    .getByRole("textbox", { name: airaCopy.askAira })
    .fill("Make the frame a row with a wider gap and fill it teal")
  await page.keyboard.press("Enter")
  await expect.poll(inRow).toBe(true)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const slideArea = await canvas.boundingBox()
  await page.mouse.click(slideArea.x + slideArea.width - 20, slideArea.y + slideArea.height - 20)
  await expect(canvas.locator("[data-selection]")).toHaveCount(0)
  await element(4).click()
  await expect(panel.getByRole("textbox", { name: frameCopy.gap, exact: true })).toHaveValue("24")
  const backdrop = `${frame.split(".")[0]}.3`
  await expect
    .poll(async () => (await saved()).register.elements[backdrop]?.landed.at(-1))
    .toMatchObject({ actor: "agent", patch: { fills: { p0: { set: { solid: { rgb: "1E9AA8" } } } } } })
  await capture("aira-row-teal")

  await page.getByRole("button", { name: "Agent", exact: true }).click()
  await page.locator("[data-editor-panel]").getByRole("button", { name: undoCopy.undo, exact: true }).click()
  await expect.poll(stacked).toBe(true)
  await capture("aira-undone")
  note(
    `The fixture's auto layout frame (${frame}) opened as one, and design mode's Auto layout section showed it Horizontal with its gap and padding. Vertical stacked the oval under the rectangle. Aira's replayed edit_deck set the frame's layout back to a row with a 24 pt gap and a teal fill: the row came back, the gap field read 24, and the fill landed on the frame's backdrop (${backdrop}) as the agent's row. The panel's Undo took Aira's change back and the column returned.`,
  )
}
