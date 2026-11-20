import { shapeCopy, undoCopy } from "../bin/product-copy.mjs"
import path from "node:path"
import { expect } from "@playwright/test"

const part = "ppt/slides/slide1.xml"
const emuPerPixel = 15_240
const original = { x: 4_114_800, y: 1_371_600, cx: 2_743_200, cy: 1_828_800 }
const snapped = { ...original, x: 290 * emuPerPixel, y: 225 * emuPerPixel }

function lastBox(register, node) {
  const rows = register?.elements?.[node]?.landed ?? []
  return rows.filter((row) => row.visible && row.property === "box").at(-1)?.value ?? null
}

async function hold(page, from, to) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 10 })
}

export default async function drive({ repo, page, signIn, post, capture, note, deckRoutes }) {
  const { cookie } = await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/shapes-added.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const shape = (number) => page.locator(`[data-slide-paint] [data-canvas-element="${part}#${number}"]`)
  const placed = (number) =>
    shape(number).evaluate((frame) =>
      [frame.style.left, frame.style.top, frame.style.width, frame.style.height].map((each) => Number.parseFloat(each)),
    )
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  const origin = { x: Math.round(slide.x), y: Math.round(slide.y) }
  const serverBox = async (node) => lastBox((await post(deckRoutes.open, { deck }, cookie)).json.register, node)
  expect(await placed(5)).toEqual([270, 90, 180, 120])
  note(
    `imported shapes-added.pptx as deck ${deck}; the ellipse sits at 270,90 and the subtitle's top at 225 on the 800 px slide`,
  )

  await hold(page, { x: origin.x + 360, y: origin.y + 150 }, { x: origin.x + 380, y: origin.y + 287 })
  await expect(page.locator('[data-guides] [data-guide="snap y 225"]')).toHaveCount(1)
  expect(await placed(5)).toEqual([290, 225, 180, 120])
  await capture("snap-held")
  note(
    "dragging the ellipse by 20,137 px brought its top to 227, 2 px from the subtitle's top and the slide's middle; it snapped to 225 and a red snap guide ran through both while the pointer was held",
  )
  await page.mouse.up()
  await expect(page.locator("[data-guides]")).toHaveCount(0)
  expect(await placed(5)).toEqual([290, 225, 180, 120])
  await capture("snap-dropped")
  await expect.poll(() => serverBox("256.5"), { timeout: 20_000 }).toEqual(snapped)
  note(
    `letting go removed the guide; the server's last box row for 256.5 is the snapped box ${JSON.stringify(snapped)}`,
  )
  await page.getByRole("button", { name: undoCopy.undoNamed.move, exact: true }).click()
  await expect.poll(() => placed(5)).toEqual([270, 90, 180, 120])
  await expect.poll(() => serverBox("256.5"), { timeout: 20_000 }).toEqual(original)
  await capture("snap-undone")
  note("one Undo put the ellipse back at 270,90, and the server's last box row is the file's box again")

  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: shapeCopy.shapes.square, exact: true }).click()
  await page.keyboard.press("Enter")
  await expect(shape(7)).toBeVisible()
  const added = await placed(7)
  const grab = (left, top) => ({ x: origin.x + left + added[2] / 2, y: origin.y + top + added[3] / 2 })
  await hold(page, grab(added[0], added[1]), grab(added[0], added[1]))
  await page.keyboard.down("Control")
  await page.mouse.move(grab(600, 100).x, grab(600, 100).y, { steps: 10 })
  await page.mouse.up()
  await page.keyboard.up("Control")
  await expect.poll(() => placed(7)).toEqual([600, 100, added[2], added[3]])
  note(
    `Shapes, Rectangle added a ${added[2]} by ${added[3]} px rectangle; a drag with Control held put it at 600,100 with no snapping`,
  )
  await hold(page, grab(600, 100), grab(483, 100))
  await expect(page.locator('[data-guides] [data-guide^="spacing x"]')).toHaveCount(2)
  expect((await placed(7))[0]).toBe(480)
  await capture("spacing-held")
  note(
    "dragging it left to 483 snapped it to 480, repeating the 30 px gap between the rectangle and the ellipse, and two pink spacing guides marked both gaps",
  )
  await page.mouse.up()
  await expect(page.locator("[data-guides]")).toHaveCount(0)
  expect((await placed(7))[0]).toBe(480)
  await capture("spacing-dropped")
}
