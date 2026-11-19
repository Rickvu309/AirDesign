import path from "node:path"
import { expect } from "@playwright/test"
import { groupCopy } from "../../../../apps/web/src/copy/arrange-copy.ts"
import { fillCopy, fillWords } from "../../../../apps/web/src/copy/fill-copy.ts"
import { frameCopy } from "../../../../apps/web/src/copy/frame-copy.ts"
import { shapeCopy } from "../../../../apps/web/src/copy/shape-copy.ts"
import { transitionCopy } from "../../../../apps/web/src/copy/transition-copy.ts"
import { undoCopy } from "../../../../apps/web/src/copy/undo-copy.ts"

const slide = "ppt/slides/slide1.xml"
const fixture = "scripts/pptx-fixtures/blank.pptx"

export default async function drive({ page, signIn, post, capture, note, deckRoutes, repo }) {
  const { cookie } = await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, fixture))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const canvas = page.locator("[data-slide-paint]")
  const element = (shape) => canvas.locator(`[data-canvas-element="${slide}#${shape}"]`)
  const status = canvas.getByRole("status")
  const panel = page.locator("[data-design-panel]")
  const saved = async () => (await post(deckRoutes.open, { deck }, cookie)).json
  const insert = async (name) => {
    await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
    await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
  }
  const boxes = async () => Promise.all([element(4).boundingBox(), element(5).boundingBox()])
  const near = (left, right) =>
    left.every((box, at) => {
      const other = right[at]
      return (
        box !== null &&
        other !== null &&
        Math.abs(box.x - other.x) <= 1.5 &&
        Math.abs(box.y - other.y) <= 1.5 &&
        Math.abs(box.width - other.width) <= 1.5 &&
        Math.abs(box.height - other.height) <= 1.5
      )
    })
  const holds = async (expected) => expect.poll(async () => near(await boxes(), expected)).toBe(true)
  const center = async (shape) => {
    const box = await element(shape).boundingBox()
    if (box === null) throw new Error(`no shape ${shape}`)
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }

  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await insert(shapeCopy.shapes.square)
  await expect(element(4)).toBeVisible()
  await insert(shapeCopy.shapes.circle)
  await expect(element(5)).toBeVisible()
  const ellipse = await center(5)
  const rectangle = await center(4)
  await page.mouse.move(ellipse.x, ellipse.y)
  await page.mouse.down()
  await page.mouse.move(rectangle.x + 260, rectangle.y + 12, { steps: 6 })
  await page.mouse.up()
  const loose = await boxes()
  await capture("two-shapes")

  await element(4).click()
  await element(5).click({ modifiers: ["Shift"] })
  await expect(canvas.locator("[data-chosen]")).toHaveCount(2)
  await page.keyboard.press("Shift+A")
  await expect(status).toHaveText(groupCopy.said.frame)
  await expect
    .poll(async () => (await saved()).register.order.at(-1))
    .toMatchObject({ slide: "element-group", backdrop: { kind: "shape" } })
  const wrap = (await saved()).register.order.at(-1)
  const frame = wrap.element.node
  const backdrop = wrap.backdrop.node.split(".")[1]
  await expect(canvas.locator("[data-selection]")).toHaveAttribute("data-selection", frame)
  await expect(panel.getByText(frameCopy.autoFrame, { exact: true })).toBeVisible()
  await expect(panel.getByRole("button", { name: frameCopy.removeAutoLayout })).toBeVisible()
  const [left, right] = await boxes()
  expect(right.x).toBeGreaterThanOrEqual(left.x + left.width - 1)
  expect(Math.abs(right.y - left.y)).toBeLessThanOrEqual(1.5)
  const laid = await boxes()
  await capture("wrapped")

  await panel.getByRole("group", { name: fillCopy.section }).getByRole("button", { name: fillWords.solid }).click()
  await expect
    .poll(async () => Object.keys((await saved()).register.elements[wrap.backdrop.node]?.landed.at(-1)?.patch ?? {}))
    .toContain("fills")
  await expect(element(backdrop)).toBeVisible()
  await holds(laid)
  await capture("frame-filled")

  const inside = await element(backdrop).boundingBox()
  await page.mouse.click(inside.x + 2, inside.y + inside.height - 2)
  await expect(canvas.locator("[data-selection]")).toHaveAttribute("data-selection", frame)

  await panel.getByRole("button", { name: frameCopy.removeAutoLayout }).click()
  await expect(panel.getByText(frameCopy.frame, { exact: true })).toBeVisible()
  await expect(panel.getByRole("button", { name: frameCopy.removeAutoLayout })).toHaveCount(0)
  await holds(laid)
  await capture("auto-layout-removed")
  await page.getByRole("button", { name: undoCopy.undoNamed["remove-auto-layout"], exact: true }).click()
  await expect(panel.getByText(frameCopy.autoFrame, { exact: true })).toBeVisible()
  await holds(laid)
  await page.getByRole("button", { name: undoCopy.undoNamed.fill, exact: true }).click()
  await page.getByRole("button", { name: undoCopy.undoNamed["add-auto-layout"], exact: true }).click()
  await expect(element(backdrop)).toHaveCount(0)
  await holds(loose)
  await capture("wrap-undone")
  await page.getByRole("button", { name: undoCopy.redoNamed["add-auto-layout"], exact: true }).click()
  await expect(element(backdrop)).toHaveCount(1)
  await holds(laid)
  await page.getByRole("button", { name: undoCopy.redoNamed.fill, exact: true }).click()

  await page.reload()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await holds(laid)
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "auto-layout-frame.pptx")
  await (await downloading).saveAs(exported)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(exported)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const reopened = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", reopened)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await expect(element(frame.split(".")[1])).toHaveCount(1)
  await holds(laid)
  await capture("reimported")

  await page.goto(`/deck/${deck}`)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await holds(laid)
  await element(4).click()
  await expect(canvas.locator("[data-selection]")).toHaveAttribute("data-selection", frame)
  await panel.getByRole("button", { name: frameCopy.removeAutoLayout }).click()
  await expect(panel.getByText(frameCopy.frame, { exact: true })).toBeVisible()
  await element(5).click()
  await expect(canvas.locator("[data-selection]")).toHaveAttribute("data-selection", wrap.members[1].node)
  const child = await center(5)
  await page.mouse.move(child.x, child.y)
  await page.mouse.down()
  await page.mouse.move(child.x, child.y - 90, { steps: 8 })
  await page.mouse.up()
  await holds([laid[0], { ...laid[1], y: laid[1].y - 90 }])
  await capture("child-moved-in-frame")
  const moved = await saved()
  const relative = moved.register.elements[wrap.members[1].node]?.landed.at(-1)?.value
  expect(relative?.x).toBeGreaterThan(0)
  expect(relative?.x).toBeLessThan(wrap.element.box.cx + 1)
  await element(4).click()
  await page.keyboard.press("Escape")
  await element(4).click()
  await expect(canvas.locator("[data-selection]")).toHaveAttribute("data-selection", frame)
  await page.keyboard.press("Shift+A")
  await expect(panel.getByText(frameCopy.autoFrame, { exact: true })).toBeVisible()
  await holds(laid)
  await capture("auto-layout-again")

  note(
    `A rectangle and an ellipse, chosen with Shift+click, became an auto layout frame with Shift+A: the ellipse moved to sit beside the rectangle at the guessed gap, top aligned, and the panel read Auto layout frame with Remove auto layout. A solid fill landed on the frame's backdrop (shape ${backdrop}) without moving either shape; a click on the backdrop selected the frame. Remove auto layout turned the title to Frame with nothing moving, and its Undo brought auto layout back. A reload kept every place, the export ${path.basename(exported)} re-imported with the group where it was, Undo fill then Undo add auto layout put both shapes back where they started with the backdrop gone, and Redo brought the frame back laid out, before the reload. Back on the deck, Remove auto layout, a second click on the ellipse selected it inside the frame, and a drag moved it 90 px up on its own, stored relative to the frame; Shift+A on the frame laid it back in the row.`,
  )
}
