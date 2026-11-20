import { undoCopy } from "../bin/product-copy.mjs"
import path from "node:path"
import { expect } from "@playwright/test"

const part = "ppt/slides/slide1.xml"

function clones(register) {
  return (register?.order ?? [])
    .filter((command) => command.slide === "element-clone")
    .map((command) => [command.source, command.element.node, command.element.box])
}

function gone(register) {
  return (register?.order ?? []).filter((command) => command.slide === "element-remove").map((command) => command.node)
}

export default async function drive({ repo, page, signIn, post, capture, note, deckRoutes }) {
  const { cookie } = await signIn()
  await page.goto(".")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = new URL(page.url()).pathname.replace(/^\/deck\//, "")
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const shape = (number) => page.locator(`[data-slide-paint] [data-canvas-element="${part}#${number}"]`)
  const placed = (number) =>
    shape(number).evaluate((frame) =>
      [frame.style.left, frame.style.top, frame.style.width, frame.style.height].map((each) => Number.parseFloat(each)),
    )
  const chosen = page.locator("[data-slide-paint] [data-selection]")
  const server = async () => (await post(deckRoutes.open, { deck }, cookie)).json.register
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  const origin = { x: Math.round(slide.x), y: Math.round(slide.y) }
  expect(await placed(2)).toEqual([30, 30, 360, 120])
  note(`imported clean.pptx as deck ${deck}; its rectangle "Hello" sits at 30,30 and is 360 by 120 px`)

  await shape(2).click({ position: { x: 70, y: 50 } })
  await expect(chosen).toHaveAttribute("data-selection", "256.2")
  const from = { x: origin.x + 100, y: origin.y + 80 }
  await page.mouse.move(from.x, from.y)
  await page.keyboard.down("AltLeft")
  await page.mouse.down()
  await page.mouse.move(from.x + 40, from.y + 150, { steps: 10 })
  await expect(page.locator("[data-copied-layer]")).toHaveCount(1)
  expect(await placed(2)).toEqual([70, 180, 360, 120])
  await capture("duplicate-held")
  note("with Alt held, dragging the rectangle by 40,150 px leaves it painted at 30,30 and moves a copy to 70,180")
  await page.mouse.up()
  await page.keyboard.up("AltLeft")
  await expect(shape(3)).toBeVisible()
  await expect(page.locator("[data-copied-layer]")).toHaveCount(0)
  expect(await placed(2)).toEqual([30, 30, 360, 120])
  expect(await placed(3)).toEqual([70, 180, 360, 120])
  await expect(chosen).toHaveAttribute("data-selection", "256.3")
  await capture("duplicate-dropped")
  note("letting go lands the copy 256.3 at 70,180, directly above the rectangle, and selects it; the rectangle stays")

  await page.keyboard.press("ControlOrMeta+KeyD")
  await expect(shape(4)).toBeVisible()
  expect(await placed(4)).toEqual([110, 330, 360, 120])
  await expect(chosen).toHaveAttribute("data-selection", "256.4")
  await capture("duplicated")
  note("Ctrl+D on the copy makes 256.4 the same 40,150 px further on and selects it")
  await expect
    .poll(async () => clones(await server()), { timeout: 20_000 })
    .toEqual([
      ["256.2", "256.3", { x: 1_066_800, y: 2_743_200, cx: 5_486_400, cy: 1_828_800 }],
      ["256.3", "256.4", { x: 1_676_400, y: 5_029_200, cx: 5_486_400, cy: 1_828_800 }],
    ])
  note("the server keeps two element-clone rows: 256.3 from 256.2 and 256.4 from 256.3, each with its own box")

  await page.getByRole("button", { name: undoCopy.undoNamed["duplicate-layer"], exact: true }).click()
  await expect(shape(4)).toHaveCount(0)
  await expect(shape(3)).toBeVisible()
  await expect.poll(async () => gone(await server()), { timeout: 20_000 }).toEqual(["256.4"])
  await capture("duplicate-undone")
  note("one Undo duplicate layer takes away 256.4 and nothing else; the server removes 256.4 only")
}
