import { execFileSync } from "node:child_process"
import path from "node:path"
import { expect } from "@playwright/test"
import { shapeCopy, shortcutCopy, transitionCopy } from "../bin/product-copy.mjs"

const fixture = "scripts/pptx-fixtures/picture-png.pptx"
const slide = "ppt/slides/slide1.xml"

export default async function drive({ page, signIn, post, capture, note, deckRoutes, repo }) {
  const { cookie } = await signIn()
  await page.goto("./")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, fixture))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().slice(page.url().lastIndexOf("deck/") + "deck/".length)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const canvas = page.locator("[data-slide-paint]")
  const element = (shape) => canvas.locator(`[data-canvas-element="${slide}#${shape}"]`)
  const selection = canvas.locator("[data-selection]")
  const boxOf = async (locator) => {
    const box = await locator.boundingBox()
    if (box === null) throw new Error("no box")
    return box
  }
  const middle = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })
  const same = (left, right) => ["x", "y", "width", "height"].every((side) => Math.abs(left[side] - right[side]) <= 2)

  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: shapeCopy.shapes.circle, exact: true }).click()
  await expect(selection).toHaveCount(1)
  const circleId = (await selection.getAttribute("data-selection"))?.split(".")[1]
  const circle = element(circleId)
  const picture = element(4)
  const from = middle(await boxOf(selection))
  const to = middle(await boxOf(picture))
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x + 40, to.y, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.press("BracketLeft")
  await picture.click({ modifiers: [shortcutCopy.chord.other.shift], position: { x: 8, y: 8 } })
  await expect(canvas.locator("[data-chosen]")).toHaveCount(2)
  const wide = await boxOf(picture)
  await page.keyboard.press("Control+Alt+KeyM")
  await expect(canvas.locator("[data-mask-clip]")).toHaveCount(1)
  await expect(selection).toHaveCount(1)
  const mask = await boxOf(circle)
  expect(wide.width).toBeGreaterThan(mask.width)
  await expect.poll(async () => same(await boxOf(selection), mask)).toBe(true)
  await capture("mask-group-selected")

  await page.mouse.dblclick(middle(mask).x, middle(mask).y)
  await expect(selection).toHaveAttribute("data-selection", /\.4$/)
  for (let step = 0; step < 4; step += 1) await page.keyboard.press("Shift+ArrowRight")
  await expect.poll(async () => (await boxOf(picture)).x).toBeGreaterThan(wide.x + 20)
  await capture("masked-layer-moved")

  const paint = await boxOf(canvas)
  await page.mouse.click(paint.x + 20, paint.y + paint.height - 20)
  await expect(selection).toHaveCount(0)
  await page.mouse.click(middle(mask).x, middle(mask).y)
  await expect(selection).toHaveCount(1)
  await expect(selection).not.toHaveAttribute("data-selection", /\.4$/)
  await expect.poll(async () => same(await boxOf(selection), mask)).toBe(true)
  await capture("mask-group-still-fits")

  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page.locator("[data-design-mode]").click()
  const layers = page.locator("[data-layers-panel]")
  await expect(layers.getByText("Mask group", { exact: true })).toHaveCount(1)
  await page.mouse.move(4, 4)
  await capture("mask-group-named")

  const group = (await selection.getAttribute("data-selection")) ?? ""
  const saved = (await post(deckRoutes.open, { deck }, cookie)).json
  const named = saved.register.elements[group]?.landed.some(
    (row) => row.visible && row.patch?.identity?.name?.set === "Mask group",
  )
  expect(named).toBe(true)

  await page.reload()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const reopened = await boxOf(circle)
  await page.mouse.click(middle(reopened).x, middle(reopened).y)
  await expect(selection).toHaveAttribute("data-selection", group)
  await expect.poll(async () => same(await boxOf(selection), reopened)).toBe(true)
  await capture("mask-group-reopened")
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: shortcutCopy.gestures.export, exact: true }).click()
  await expect(
    page
      .getByRole("dialog", { name: shortcutCopy.gestures.export })
      .getByRole("button", { name: shortcutCopy.gestures.export }),
  ).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "mask-group.pptx")
  await (await downloading).saveAs(exported)
  const diff = execFileSync("node", ["scripts/deck-diff.mjs", path.join(repo, fixture), exported, "--allow", slide], {
    cwd: repo,
    encoding: "utf8",
  })
  expect(diff).toContain("0 added, 0 removed")
  note(
    `picture-png.pptx: a circle over the picture and the picture, masked with Ctrl+Alt+M, made one group whose selection frame is the circle's box (${Math.round(mask.width)} px wide), not the picture's (${Math.round(wide.width)} px). The picture moved 40 px right inside the group by double-click and Shift+Arrow, and the group's frame stayed on the circle. The layers panel and the server copy name the group "Mask group". After a reload the frame still fits the circle, and the export ${path.basename(exported)} changes only ${slide}.`,
  )
}
