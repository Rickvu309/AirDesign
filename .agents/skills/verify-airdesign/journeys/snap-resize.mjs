import path from "node:path"
import { expect } from "@playwright/test"
import { undoCopy } from "../bin/product-copy.mjs"

const part = "ppt/slides/slide1.xml"
const emuPerPixel = 15_240
const ellipse = { x: 270, y: 90, cx: 180, cy: 120 }
const stretched = { ...ellipse, cy: 135 }

function lastBox(register, node) {
  const rows = register?.elements?.[node]?.landed ?? []
  return rows.filter((row) => row.visible && row.property === "box").at(-1)?.value ?? null
}

function emuBox(box) {
  return { x: box.x * emuPerPixel, y: box.y * emuPerPixel, cx: box.cx * emuPerPixel, cy: box.cy * emuPerPixel }
}

function listed(box) {
  return [box.x, box.y, box.cx, box.cy]
}

async function centerOf(locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("no box")
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
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
  const guide = (name) => page.locator(`[data-guides] [data-guide="${name}"]`)
  const grip = (name) => page.locator(`[data-slide-paint] [data-selection] [data-grip="${name}"]`)
  const serverBox = async (node) => lastBox((await post(deckRoutes.open, { deck }, cookie)).json.register, node)
  async function press(at, key) {
    await page.mouse.move(at.x, at.y)
    if (key !== undefined) await page.keyboard.down(key)
    await page.mouse.down()
  }
  async function cancel(key) {
    if (key !== undefined) await page.keyboard.up(key)
    await page.keyboard.press("Escape")
    await page.mouse.up()
  }
  expect(await placed(5)).toEqual(listed(ellipse))
  note(
    `imported shapes-added.pptx as deck ${deck}; the ellipse sits at 270,90, 180 by 120, the line ends at x 540 and the subtitle's top and the slide's middle are at y 225`,
  )

  await shape(5).click()
  const right = await centerOf(grip("right"))
  await press(right, "Alt")
  await page.mouse.move(right.x + 88, right.y, { steps: 10 })
  await expect(guide("snap x 540")).toHaveCount(1)
  expect(await placed(5)).toEqual([180, 90, 360, 120])
  await capture("alt-edge-snap-held")
  note(
    "Alt-dragging the right edge by 88 px grew the ellipse from its centre to 538; the right edge snapped to the line's end at 540, the left edge moved out the same 90 px to 180, and a red snap guide ran through x 540",
  )
  await page.keyboard.down("Control")
  await expect(page.locator("[data-guides]")).toHaveCount(0)
  await expect.poll(() => placed(5)).toEqual([182, 90, 356, 120])
  await capture("alt-edge-control-held")
  note("holding Control mid-drag let go of the snap: the edge went back to 538 under the pointer and the guide went")
  await page.keyboard.up("Control")
  await cancel("Alt")
  await expect.poll(() => placed(5)).toEqual(listed(ellipse))

  await press(right, "Shift")
  await page.mouse.move(right.x + 88, right.y, { steps: 10 })
  await expect(guide("snap x 540")).toHaveCount(1)
  expect(await placed(5)).toEqual([270, 60, 270, 180])
  await capture("shift-edge-snap-held")
  note(
    "Shift-dragging the right edge by 88 px kept the 3:2 proportions about the ellipse's middle; the right edge snapped to 540 and the height followed to 180",
  )
  await cancel("Shift")
  await expect.poll(() => placed(5)).toEqual(listed(ellipse))

  const bottom = await centerOf(grip("bottom"))
  await press(bottom)
  await page.mouse.move(bottom.x, bottom.y + 13, { steps: 10 })
  await expect(guide("snap y 225")).toHaveCount(1)
  expect(await placed(5)).toEqual(listed(stretched))
  await capture("edge-snap-held")
  await page.mouse.up()
  await expect(page.locator("[data-guides]")).toHaveCount(0)
  await expect.poll(() => serverBox("256.5"), { timeout: 20_000 }).toEqual(emuBox(stretched))
  note(
    `dragging the bottom edge down 13 px snapped it to y 225; on release the guide went and the server's last box row for 256.5 is ${JSON.stringify(emuBox(stretched))}`,
  )
  await page.getByRole("button", { name: undoCopy.undoNamed.resize, exact: true }).click()
  await expect.poll(() => placed(5)).toEqual(listed(ellipse))
  await expect.poll(() => serverBox("256.5"), { timeout: 20_000 }).toEqual(emuBox(ellipse))
  note("one Undo put the ellipse back to 120 px tall on the canvas and on the server")

  await shape(4).click()
  await shape(5).click({ modifiers: ["Shift"] })
  const around = page.locator('[data-selection-around="2"]')
  await expect(around).toBeVisible()
  const corner = await centerOf(around.locator('[data-grip="bottom-right"]'))
  await press(corner)
  await page.mouse.move(corner.x + 88, corner.y + 13, { steps: 10 })
  await expect(guide("snap x 540")).toHaveCount(1)
  await expect(guide("snap y 225")).toHaveCount(1)
  const scaled = await placed(5)
  expect(scaled[0] + scaled[2]).toBeCloseTo(540, 1)
  expect(scaled[1] + scaled[3]).toBeCloseTo(225, 1)
  await capture("multi-snap-held")
  note(
    "with the rectangle and the ellipse selected, dragging the shared corner by 88,13 px snapped the selection's right edge to 540 and its bottom to 225, and both layers scaled with it",
  )
  await cancel()
  await expect.poll(() => placed(5)).toEqual(listed(ellipse))

  await shape(4).click()
  await expect(page.locator("[data-slide-paint] [data-selection] [data-grip]")).toHaveCount(12)
  const middle = await centerOf(shape(4))
  const turn = await centerOf(grip("rotate-top-right"))
  const reach = Math.hypot(turn.x - middle.x, turn.y - middle.y)
  const angle = Math.atan2(turn.y - middle.y, turn.x - middle.x) + Math.PI / 2
  await press(turn, "Shift")
  await page.mouse.move(middle.x + reach * Math.cos(angle), middle.y + reach * Math.sin(angle), { steps: 10 })
  await page.mouse.up()
  await page.keyboard.up("Shift")
  await expect.poll(() => shape(4).evaluate((frame) => frame.style.transform)).toContain("rotate(90deg)")
  const top = await centerOf(grip("top"))
  await press(top)
  await page.mouse.move(top.x + 58, top.y, { steps: 10 })
  await expect(guide("snap x 270")).toHaveCount(1)
  expect(await placed(4)).toEqual([90, 60, 180, 180])
  await capture("turned-edge-snap-held")
  note(
    "with the rectangle turned 90°, its top handle sits on the right of the screen; dragging it 58 px right snapped the turned rectangle's outermost right side to the ellipse's left at 270",
  )
  await cancel()
  await expect.poll(() => placed(4)).toEqual([60, 90, 180, 120])
}
