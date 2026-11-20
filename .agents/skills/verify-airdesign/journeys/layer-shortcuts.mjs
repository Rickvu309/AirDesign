import path from "node:path"
import { expect } from "@playwright/test"
import {
  arrangeCopy,
  frameCopy,
  groupCopy,
  layersCopy,
  shapeCopy,
  transitionCopy,
  undoCopy,
} from "../bin/product-copy.mjs"

const slide = "ppt/slides/slide1.xml"
const fixture = "scripts/pptx-fixtures/blank.pptx"

export default async function drive({ page, signIn, post, capture, note, deckRoutes, repo }) {
  const { cookie } = await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, fixture))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)

  const element = (shape) => page.locator(`[data-slide-paint] [data-canvas-element="${slide}#${shape}"]`)
  const status = page.locator("[data-slide-paint]").getByRole("status")
  const register = async () => (await post(deckRoutes.open, { deck }, cookie)).json.register
  const insert = async (name) => {
    await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
    await page.keyboard.press("Enter")
    await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
  }
  const painted = (where, ids) => {
    const mark = where === "[data-thumb-paint]" ? "data-thumb-element" : "data-canvas-element"
    return page
      .locator(`${where} [${mark}]`)
      .evaluateAll(
        (all, args) =>
          all
            .map((each) => /(\d+)$/.exec(each.getAttribute(args.mark) ?? "")?.[1] ?? "")
            .filter((shape) => args.ids.includes(shape)),
        { mark, ids },
      )
  }

  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await insert(shapeCopy.shapes.square)
  await expect(element(4)).toBeVisible()
  await insert(shapeCopy.shapes.circle)
  await expect(element(5)).toBeVisible()
  await insert(shapeCopy.shapes.triangle)
  await expect(element(6)).toBeVisible()

  const rectBox = await element(4).boundingBox()
  const circleBox = await element(5).boundingBox()
  const triBox = await element(6).boundingBox()
  if (rectBox === null || circleBox === null || triBox === null) throw new Error("missing shape")
  await page.mouse.move(circleBox.x + circleBox.width / 2, circleBox.y + circleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(rectBox.x + rectBox.width * 1.05, rectBox.y + rectBox.height * 0.75, { steps: 6 })
  await page.mouse.up()
  await page.mouse.move(triBox.x + triBox.width / 2, triBox.y + triBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(rectBox.x + rectBox.width * 1.55, rectBox.y + rectBox.height * 0.95, { steps: 6 })
  await page.mouse.up()

  const trio = ["4", "5", "6"]
  await expect.poll(() => painted("[data-slide-paint]", trio)).toEqual(["4", "5", "6"])
  await element(4).click({ position: { x: 12, y: 12 } })
  await page.keyboard.press("BracketRight")
  await expect(status).toHaveText(arrangeCopy.said.front)
  await expect.poll(() => painted("[data-slide-paint]", trio)).toEqual(["5", "6", "4"])
  await expect.poll(() => painted("[data-thumb-paint]", trio)).toEqual(["5", "6", "4"])
  await capture("brought-to-front")

  await page.keyboard.press("Control+BracketLeft")
  await expect(status).toHaveText(arrangeCopy.said.backward)
  await expect.poll(() => painted("[data-slide-paint]", trio)).toEqual(["5", "4", "6"])

  await page.keyboard.press("Control+BracketRight")
  await expect(status).toHaveText(arrangeCopy.said.forward)
  await expect.poll(() => painted("[data-slide-paint]", trio)).toEqual(["5", "6", "4"])

  await page.keyboard.press("BracketLeft")
  await expect(status).toHaveText(arrangeCopy.said.back)
  await expect.poll(() => painted("[data-slide-paint]", trio)).toEqual(["4", "5", "6"])
  await expect.poll(async () => (await register()).order.some((row) => row.slide === "element-order")).toBe(true)

  const before = [await element(4).boundingBox(), await element(5).boundingBox()]
  await element(4).click({ position: { x: 12, y: 12 } })
  await element(5).click({ modifiers: ["Shift"], position: { x: 40, y: 40 } })
  await page.keyboard.press("Control+Alt+KeyG")
  await expect(status).toHaveText(groupCopy.said["plain-frame"])
  await expect(page.locator("[data-design-panel]").getByText(frameCopy.frame, { exact: true })).toBeVisible()
  const after = [await element(4).boundingBox(), await element(5).boundingBox()]
  for (const [at, box] of before.entries()) {
    expect(Math.abs(after[at].x - box.x)).toBeLessThanOrEqual(1.5)
    expect(Math.abs(after[at].y - box.y)).toBeLessThanOrEqual(1.5)
  }
  await expect
    .poll(async () =>
      (await register()).order.some(
        (row) =>
          row.slide === "element-group" &&
          row.backdrop !== undefined &&
          row.element.opening?.layout?.flow?.set === "none",
      ),
    )
    .toBe(true)
  await capture("plain-framed")

  await page.evaluate(() => {
    window.__sameDoc = true
  })
  await page.keyboard.press("Control+KeyR")
  expect(await page.evaluate(() => window.__sameDoc)).toBe(true)
  const layers = page.locator("[data-layers-panel]")
  await expect(layers.getByRole("heading", { name: layersCopy.section })).toBeVisible()
  const field = layers.locator("[data-layer-name-field]")
  await expect(field).toBeFocused()
  await capture("rename-open")
  await field.fill("Hero frame")
  await field.press("Enter")
  await expect(layers.getByRole("treeitem", { name: "Hero frame", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.rename, exact: true })).toBeEnabled()
  await expect.poll(async () => JSON.stringify(await register()).includes('"name":{"set":"Hero frame"}')).toBe(true)
  await capture("renamed")

  await page.reload()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await page.locator("[data-design-mode]").click()
  await expect(layers.getByRole("treeitem", { name: "Hero frame", exact: true })).toBeVisible()
  await capture("reloaded")

  note(
    `Three overlapping shapes reordered with ], Ctrl+[, and [ across the slide, thumbnail, and server register (element-order). Ctrl+Alt+G wrapped two offset shapes in a plain Frame without moving either child, keeping flow none and a backdrop in the server register. Ctrl+R opened Design mode and focused the Layers panel inline rename field without reloading the document, renamed the frame to Hero frame, saved identity.name to the server, and survived a full reload.`,
  )
}
