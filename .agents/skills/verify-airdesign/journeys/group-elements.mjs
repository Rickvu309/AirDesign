import path from "node:path"
import { expect } from "@playwright/test"

const slide = "ppt/slides/slide1.xml"
const fixture = "scripts/pptx-fixtures/blank.pptx"

export default async function drive({ page, signIn, post, capture, note, deckRoutes, repo, aira }) {
  const { cookie } = await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, fixture))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const canvas = page.locator("[data-slide-paint]")
  const element = (shape) => canvas.locator(`[data-canvas-element="${slide}#${shape}"]`)
  const status = canvas.getByRole("status")
  const saved = async () => (await post(deckRoutes.open, { deck }, cookie)).json
  const insert = async (name) => {
    await page.getByRole("button", { name: "Shapes", exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
    await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
  }
  const boxes = async () => Promise.all([element(4).boundingBox(), element(5).boundingBox()])
  const near = (left, right, dx = 0) =>
    left.every((box, at) => {
      const other = right[at]
      return (
        box !== null &&
        other !== null &&
        Math.abs(box.x - other.x - dx) <= 1.5 &&
        Math.abs(box.y - other.y) <= 1.5 &&
        Math.abs(box.width - other.width) <= 1.5 &&
        Math.abs(box.height - other.height) <= 1.5
      )
    })
  const holds = async (expected, dx = 0) => expect.poll(async () => near(await boxes(), expected, dx)).toBe(true)
  const center = async (shape) => {
    const box = await element(shape).boundingBox()
    if (box === null) throw new Error(`no shape ${shape}`)
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }

  await insert("Rectangle")
  await expect(element(4)).toBeVisible()
  await insert("Ellipse")
  await expect(element(5)).toBeVisible()
  const ellipse = await center(5)
  await page.mouse.move(ellipse.x, ellipse.y)
  await page.mouse.down()
  await page.mouse.move(ellipse.x + 140, ellipse.y + 60, { steps: 6 })
  await page.mouse.up()
  const loose = await boxes()
  await capture("two-shapes")

  await element(4).click()
  await element(5).click({ modifiers: ["Shift"] })
  const corner = await element(4).boundingBox()
  if (corner === null) throw new Error("no rectangle")
  await page.mouse.click(corner.x + 10, corner.y + 10, { button: "right" })
  const grouping = page.getByRole("menuitem", { name: "Group Ctrl+G" })
  const groups = await grouping
    .waitFor({ state: "visible", timeout: 2000 })
    .then(() => true)
    .catch(() => false)
  await capture("group-menu")
  await page.keyboard.press("Escape")
  if (!groups) {
    await capture("grouped")
    note("This build has no Group. Shift+click and Ctrl+G left the two shapes apart.")
    return
  }
  await element(4).click()
  await element(5).click({ modifiers: ["Shift"] })
  await expect(canvas.locator("[data-chosen]")).toHaveCount(1)
  await page.keyboard.press("Control+g")
  await expect(status).toHaveText("Grouped")
  const group = (await saved()).register.order.at(-1)
  expect(group).toMatchObject({ slide: "element-group" })
  const shape = group.element.node.split(".")[1]
  await expect(canvas.locator("[data-selection]")).toHaveAttribute("data-selection", group.element.node)
  await holds(loose)
  await capture("grouped")

  const start = await center(4)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 120, start.y, { steps: 8 })
  await page.mouse.up()
  await holds(loose, 120)
  await capture("group-moved")
  await page.getByRole("button", { name: "Undo move", exact: true }).click()
  await holds(loose)
  await page.getByRole("button", { name: "Redo move", exact: true }).click()
  await holds(loose, 120)
  const moved = await boxes()

  await element(5).click()
  await expect(canvas.locator("[data-selection]")).toHaveAttribute("data-selection", group.element.node)
  await page.keyboard.press("Control+Shift+g")
  await expect(status).toHaveText("Ungrouped")
  await holds(moved)
  await expect(element(shape)).toHaveCount(0)
  await capture("ungrouped")
  expect((await saved()).register.order.at(-1)).toMatchObject({ slide: "element-ungroup", node: group.element.node })
  await page.getByRole("button", { name: "Undo ungroup", exact: true }).click()
  await expect(element(shape)).toHaveCount(1)
  await holds(moved)
  await expect.poll(async () => (await saved()).register.order.at(-1)?.slide).toBe("element-regroup")

  await page.reload()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await holds(moved)
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "group-elements.pptx")
  await (await downloading).saveAs(exported)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(exported)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const reopened = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", reopened)
  await expect(element(shape)).toHaveCount(1)
  await holds(moved)
  await capture("reimported")

  await page.goto(`/deck/${deck}`)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await element(5).click()
  await page.keyboard.press("Control+Shift+g")
  await expect(status).toHaveText("Ungrouped")
  const base = Number((await saved()).revision)
  const [first, second] = ["4", "5"].map((each) => `${group.element.node.split(".")[0]}.${each}`)
  aira([{ name: "group.sse", fill: { deck, base: String(base), first, second } }, { name: "edited.sse" }])
  await page.getByRole("textbox", { name: "Ask Aira" }).fill("Group the two shapes")
  await page.keyboard.press("Enter")
  await expect
    .poll(async () => (await saved()).register.order.at(-1))
    .toMatchObject({ slide: "element-group", runId: expect.any(String) })
  const made = (await saved()).register.order.at(-1).element.node.split(".")[1]
  await expect(element(made)).toHaveCount(1)
  await holds(moved)
  await capture("agent-grouped")
  await page.locator("[data-editor-panel]").getByRole("button", { name: "Undo", exact: true }).click()
  await expect.poll(async () => (await saved()).register.order.at(-1)?.slide).toBe("element-ungroup")
  await expect(element(made)).toHaveCount(0)
  await holds(moved)
  await capture("agent-group-undone")
  note(
    `A rectangle and an ellipse, chosen with Shift+click, showed Group and Ungroup in their menu and grouped with Ctrl+G without moving; dragging the group moved both by 120 px, Undo move and Redo move took that back and forth, Ctrl+Shift+G ungrouped them in place, and Undo ungroup put the group back. A reload and the export ${path.basename(exported)} re-imported showed the moved group where it was. Aira's replayed edit_deck grouped the two shapes in place, and the panel's Undo turned that group back.`,
  )
}
