import path from "node:path"
import { expect } from "@playwright/test"
import { airaCopy, shortcutCopy } from "../bin/product-copy.mjs"

const fixture = "scripts/pptx-fixtures/shapes-added.pptx"
const slide = "ppt/slides/slide1.xml"
const answer = "The rectangle now points to the oval with an arrow."

export default async function drive({ origin, page, signIn, post, capture, note, deckRoutes, repo, aira }) {
  const { cookie } = await signIn()
  await page.goto(origin)
  await page.locator("input[type=file]").setInputFiles(path.join(repo, fixture))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().match(/[^/]+$/)?.[0]
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const saved = async () => (await post(deckRoutes.open, { deck }, cookie)).json
  const canvas = page.locator("[data-slide-paint]")
  const element = (shape) => canvas.locator(`[data-canvas-element="${slide}#${shape}"]`)
  const placement = (shape) =>
    element(shape).evaluate((frame) => [frame.style.left, frame.style.top, frame.style.width, frame.style.height])

  const opened = await saved()
  const id = String(opened.register.index.slides[0].id)
  aira([{ name: "arrow.sse", fill: { deck, base: String(opened.revision), slide: id } }, { name: "arrowed.sse" }])
  const panel = page.locator("[data-editor-panel]")
  await page.getByRole("textbox", { name: airaCopy.askAira }).fill("Point the rectangle at the oval with an arrow")
  await page.keyboard.press("Enter")
  const refused = panel.locator('[data-tool-state="refused"]')
  const retry = panel.getByRole("button", { name: airaCopy.retry, exact: true })
  await expect(panel.getByText(answer).or(retry).or(refused).first()).toBeVisible()
  const added = (await saved()).register.order.find((command) => command.slide === "element-add")
  if (added?.geometry !== "straightConnector1") {
    await capture("arrow-added")
    note("This build has no agent arrow. Aira's add of an arrow was refused and the slide kept its shapes alone.")
    return
  }
  expect(added.element).toMatchObject({ node: `${id}.7`, kind: "connector" })
  const arrow = element(7)
  await expect(arrow.locator("[data-canvas-line]")).toBeVisible()
  await capture("arrow-added")

  const turned = await saved()
  aira([{ name: "elbow.sse", fill: { deck, base: String(turned.revision), slide: id } }, { name: "elbowed.sse" }])
  await page.getByRole("textbox", { name: airaCopy.askAira }).fill("Join the bottoms of the rectangle and the oval")
  await page.keyboard.press("Enter")
  const joined = "An elbow line now joins their bottoms, under both."
  await expect(panel.getByText(joined).or(retry).or(refused).first()).toBeVisible()
  const elbow = (await saved()).register.order.find((command) => command.geometry === "bentConnector3")
  if (elbow === undefined) {
    await capture("elbow-added")
    note("This build has no agent elbow. Aira's add of an elbow was refused.")
    return
  }
  await expect(element(8).locator("[data-canvas-line]")).toBeVisible()
  await capture("elbow-added")

  const placed = await placement(7)
  const oval = await element(5).boundingBox()
  if (oval === null) throw new Error("no oval")
  await element(5).click({ position: { x: 4, y: oval.height / 2 } })
  await page.mouse.move(oval.x + oval.width / 2, oval.y + oval.height / 2)
  await page.mouse.down()
  await page.mouse.move(oval.x + oval.width / 2 + 40, oval.y + oval.height / 2 + 90, { steps: 6 })
  await page.mouse.up()
  await expect.poll(() => placement(7)).not.toEqual(placed)
  const followed = await placement(7)
  await capture("arrow-followed")

  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: shortcutCopy.gestures.export, exact: true }).click()
  await expect(
    page
      .getByRole("dialog", { name: shortcutCopy.gestures.export })
      .getByRole("button", { name: shortcutCopy.gestures.export }),
  ).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("arrow-exported"))
  const exported = path.join(out, "line-add.pptx")
  await (await downloading).saveAs(exported)
  await page.goto(origin)
  await page.locator("input[type=file]").setInputFiles(exported)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", page.url().match(/[^/]+$/)?.[0])
  await expect.poll(() => placement(7)).toEqual(followed)
  await capture("arrow-reimported")
  note(
    `Aira's replayed airdesign_edit_deck added an arrow (${id}.7, straightConnector1) from the rectangle's right site to the oval's left site; it painted between them at once. Dragging the oval moved the arrow's end with it. The export ${path.basename(exported)} opened again with the arrow where it was left.`,
  )
}
