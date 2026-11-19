import path from "node:path"
import { expect } from "@playwright/test"

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
  const insert = async (name) => {
    await page.getByRole("button", { name: "Shapes", exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
    await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
  }
  await insert("Rectangle")
  await expect(element(4)).toBeVisible()
  await insert("Ellipse")
  await expect(element(5)).toBeVisible()
  const back = await element(4).boundingBox()
  const front = await element(5).boundingBox()
  if (back === null || front === null) throw new Error("no shape")
  await page.mouse.move(front.x + front.width * 0.5, front.y + front.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(back.x + back.width * 0.55, back.y + back.height * 0.45, { steps: 8 })
  await page.mouse.up()
  const painted = (where) => {
    const mark = where === "[data-thumb-paint]" ? "data-thumb-element" : "data-canvas-element"
    return page
      .locator(`${where} [${mark}$="#4"], ${where} [${mark}$="#5"]`)
      .evaluateAll((all, name) => all.map((each) => each.getAttribute(name)), mark)
  }
  await expect.poll(() => painted("[data-slide-paint]")).toEqual([`${slide}#4`, `${slide}#5`])

  await page.locator("[data-design-mode]").click()
  const layers = page.locator("[data-layers-panel]")
  await expect(layers.getByRole("heading", { name: "Layers" })).toBeVisible()
  await expect(layers.getByRole("treeitem")).toHaveCount(4)
  const names = async () => (await layers.locator("[data-layer-name]").allTextContents()).slice(0, 2)
  const [ellipse, rectangle] = await names()
  await capture("layers-listed")

  await layers.getByRole("treeitem", { name: rectangle, exact: true }).hover()
  await expect(page.locator("[data-slide-paint] [data-chosen]")).toHaveCount(1)
  await capture("layer-hovered")
  await layers.getByRole("treeitem", { name: rectangle, exact: true }).click()
  await expect(layers.getByRole("treeitem", { name: rectangle, exact: true })).toHaveAttribute("aria-selected", "true")
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(1)
  await capture("layer-selected")

  await layers.getByRole("treeitem", { name: ellipse, exact: true }).dblclick()
  const field = layers.locator("[data-layer-name-field]")
  await expect(field).toBeFocused()
  await field.fill("Badge")
  await field.press("Enter")
  await expect(layers.getByRole("treeitem", { name: "Badge", exact: true })).toBeVisible()
  await capture("layer-renamed")
  const register = async () => (await post(deckRoutes.open, { deck }, cookie)).json.register
  await expect.poll(async () => JSON.stringify(await register()).includes('"name":{"set":"Badge"}')).toBe(true)

  await layers
    .getByRole("treeitem", { name: rectangle, exact: true })
    .dragTo(layers.getByRole("treeitem", { name: "Badge", exact: true }), { targetPosition: { x: 40, y: 3 } })
  await expect.poll(names).toEqual([rectangle, "Badge"])
  await expect.poll(() => painted("[data-slide-paint]")).toEqual([`${slide}#5`, `${slide}#4`])
  await expect.poll(() => painted("[data-thumb-paint]")).toEqual([`${slide}#5`, `${slide}#4`])
  await capture("layer-reordered")
  await expect.poll(async () => (await register()).order.some((row) => row.slide === "element-order")).toBe(true)
  await page.getByRole("button", { name: "Undo layer order", exact: true }).click()
  await expect.poll(names).toEqual(["Badge", rectangle])
  await expect.poll(() => painted("[data-slide-paint]")).toEqual([`${slide}#4`, `${slide}#5`])
  await page.getByRole("button", { name: "Redo layer order", exact: true }).click()
  await expect.poll(names).toEqual([rectangle, "Badge"])

  await page.reload()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await page.locator("[data-design-mode]").click()
  await expect.poll(names).toEqual([rectangle, "Badge"])
  await capture("layers-reloaded")
  note(
    `Two overlapping shapes listed front first as ${ellipse} and ${rectangle}. Hover outlined ${rectangle} on the slide, a click selected it there, a double-click renamed ${ellipse} to Badge and the server kept the name. A drag put ${rectangle} above Badge: the slide and the filmstrip painted it in front, the server holds an element-order row, Undo layer order and Redo layer order took it back and forth, and a reload kept the order and the name.`,
  )
}
