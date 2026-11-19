import path from "node:path"
import { expect } from "@playwright/test"
import { groupCopy, shapeCopy, undoCopy } from "../bin/product-copy.mjs"

const slidePart = "ppt/slides/slide1.xml"
const fixture = "scripts/pptx-fixtures/blank.pptx"

async function drag(page, from, to, steps = 6) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps })
  await page.mouse.up()
}

export default async function drive({ page, signIn, post, capture, note, deckRoutes, repo }) {
  const { cookie } = await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, fixture))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)

  const canvas = page.locator("[data-slide-paint]")
  const shape = (number) => canvas.locator(`[data-canvas-element="${slidePart}#${number}"]`)
  const boxOf = async (locator) => {
    const box = await locator.boundingBox()
    if (box === null) throw new Error("not painted")
    return box
  }
  const slide = await boxOf(canvas)

  await drag(
    page,
    { x: slide.x + 20, y: slide.y + 20 },
    { x: slide.x + slide.width - 20, y: slide.y + slide.height - 20 },
  )
  await page.keyboard.press("Delete")
  await expect(canvas.locator("[data-canvas-element]")).toHaveCount(0)

  const place = async (name, number, target) => {
    await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
    await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
    const layer = shape(number)
    await expect(layer).toBeVisible()
    const box = await boxOf(layer)
    await drag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, target)
    return layer
  }

  const one = await place(shapeCopy.shapes.square, 4, { x: slide.x + 120, y: slide.y + 110 })
  const two = await place(shapeCopy.shapes.circle, 5, { x: slide.x + 260, y: slide.y + 110 })
  const three = await place(shapeCopy.shapes.triangle, 6, { x: slide.x + 400, y: slide.y + 110 })
  const four = await place(shapeCopy.shapes.diamond, 7, { x: slide.x + 160, y: slide.y + 280 })

  await page.mouse.click(slide.x + slide.width - 20, slide.y + slide.height - 20)
  await expect(canvas.locator("[data-selection]")).toHaveCount(0)

  const oneBox = await boxOf(one)
  await page.mouse.move(oneBox.x + oneBox.width / 2, oneBox.y + oneBox.height / 2)
  await expect(canvas.locator("[data-hover-outline]")).toHaveAttribute("data-hover-outline", /\.4$/)
  await capture("hover-outline")

  const threeBox = await boxOf(three)
  await page.mouse.move(slide.x - 24, slide.y + 30)
  await page.mouse.down()
  await page.mouse.move(threeBox.x + 24, threeBox.y + 24, { steps: 6 })
  await expect(canvas.locator("[data-slide-marquee]")).toBeVisible()
  await expect(canvas.locator("[data-chosen]")).toHaveCount(3)
  await capture("marquee-dragging")
  await page.mouse.up()
  await expect(canvas.locator("[data-slide-marquee]")).toBeHidden()
  await expect(canvas.locator("[data-selection-around]")).toHaveAttribute("data-selection-around", "3")
  await capture("marquee-three")

  const fourBox = await boxOf(four)
  await page.keyboard.down("Shift")
  await drag(page, { x: slide.x + 30, y: fourBox.y - 16 }, { x: fourBox.x + 24, y: fourBox.y + 24 })
  await page.keyboard.up("Shift")
  await expect(canvas.locator("[data-chosen]")).toHaveCount(4)
  await expect(canvas.locator("[data-selection-around]")).toHaveAttribute("data-selection-around", "4")
  await capture("shift-marquee-four")

  await one.click()
  await two.click({ modifiers: ["Shift"] })
  await page.keyboard.press("ControlOrMeta+g")
  await expect(canvas.getByRole("status")).toHaveText(groupCopy.said.group)
  const saved = async () => (await post(deckRoutes.open, { deck }, cookie)).json
  await expect.poll(async () => (await saved()).register.order.at(-1)?.slide).toBe("element-group")
  const groupNode = (await saved()).register.order.at(-1).element.node
  await capture("grouped")

  await page.mouse.click(slide.x + slide.width - 20, slide.y + slide.height - 20)
  await one.click({ modifiers: ["ControlOrMeta"] })
  await expect(canvas.locator("[data-selection]")).toHaveAttribute("data-selection", /\.4$/)
  await capture("deep-selected")

  await page.keyboard.press("Escape")
  await expect(canvas.locator("[data-selection]")).toHaveAttribute("data-selection", groupNode)
  await capture("escaped-to-group")

  const beforeMove = await boxOf(one)
  await drag(
    page,
    { x: beforeMove.x + beforeMove.width / 2, y: beforeMove.y + beforeMove.height / 2 },
    { x: beforeMove.x + beforeMove.width / 2 + 80, y: beforeMove.y + beforeMove.height / 2 + 30 },
    8,
  )
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.move, exact: true })).toBeEnabled()
  await expect.poll(async () => Math.round((await boxOf(one)).x - beforeMove.x)).toBeGreaterThanOrEqual(75)
  await expect
    .poll(async () => {
      const rows = (await saved()).register.elements[groupNode]?.landed ?? []
      return rows.some((row) => row.patch?.box?.x?.set !== undefined)
    })
    .toBe(true)
  const movedOne = await boxOf(one)
  await capture("group-dragged")

  await page.keyboard.press("Enter")
  await expect(canvas.locator("[data-chosen]")).toHaveCount(2)
  await page.keyboard.press("Tab")
  await expect(canvas.locator("[data-selection]")).toHaveAttribute("data-selection", /\.4$/)
  await page.keyboard.press("Tab")
  await expect(canvas.locator("[data-selection]")).toHaveAttribute("data-selection", /\.5$/)
  await page.keyboard.press("Shift+Enter")
  await expect(canvas.locator("[data-selection]")).toHaveAttribute("data-selection", groupNode)

  await page.reload()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await expect.poll(async () => Math.abs((await boxOf(one)).x - movedOne.x)).toBeLessThanOrEqual(1.5)
  await capture("reloaded")

  note(
    `Hovered a shape to show the 1 px blue hover outline, marquee-selected three shapes from the canvas surround, Shift-marqueed a fourth shape to add it, grouped two shapes, deep-selected a child with Cmd/Ctrl+click, pressed Escape back to the group (${groupNode}), dragged the group 80 px right and 30 px down, verified the landed box on the server and after reload, and traversed children and siblings with Enter, Tab and Shift+Enter.`,
  )
}
