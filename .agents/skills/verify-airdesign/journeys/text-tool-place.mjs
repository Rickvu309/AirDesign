import { expect } from "@playwright/test"
import { newBlankDeck } from "../bin/new-deck.mjs"
import { undoCopy } from "../bin/product-copy.mjs"

export default async function drive({ page, signIn, post, capture, note, deckRoutes }) {
  const { cookie } = await signIn()
  await page.goto("./")
  await newBlankDeck(page)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().match(/\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const slide = page.locator("[data-slide-paint]").first()
  const texts = slide.locator('[contenteditable="true"]')
  const guides = slide.locator("[data-guides]")
  const adds = async () =>
    (await post(deckRoutes.open, { deck }, cookie)).json.register.order.filter((row) => row.slide === "element-add")
      .length
  const box = await slide.boundingBox()
  if (box === null) throw new Error("slide")
  await slide.click({ position: { x: 4, y: 4 } })

  await page.keyboard.press("t")
  await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.15)
  await expect(texts).toHaveCount(1)
  await expect(texts.first()).toBeFocused()
  await capture("text-placed-empty")
  await page.keyboard.press("Escape")
  await expect(texts).toHaveCount(0)
  await expect(page.getByRole("button", { name: undoCopy.undo, exact: true })).toBeDisabled()
  await capture("empty-text-removed")
  await page.keyboard.press("t")
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.3)
  await expect(texts.first()).toBeFocused()
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.8)
  await expect(texts).toHaveCount(0)
  expect(await adds()).toBe(0)
  note(
    "T then a click placed text; Escape, and later a click away, removed it with no undo step and no element-add on the server",
  )

  await page.keyboard.press("t")
  await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.15)
  await page.keyboard.type("Costs fall 12% with two shifts", { delay: 10 })
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")
  await expect.poll(adds).toBe(1)
  const anchor = await texts.first().evaluate((node) => node.closest("[data-canvas-element]").getBoundingClientRect().x)

  await page.keyboard.press("t")
  await page.mouse.move(anchor + 3, box.y + box.height * 0.4)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5, { steps: 4 })
  await page.mouse.move(box.x + box.width / 2 - 3, box.y + box.height * 0.6, { steps: 4 })
  await expect(guides).toHaveCount(1)
  await capture("text-drag-snapped")
  await page.keyboard.down("Control")
  await page.mouse.move(box.x + box.width / 2 - 2, box.y + box.height * 0.6)
  await expect(guides).toHaveCount(0)
  await capture("text-drag-control-held")
  await page.keyboard.up("Control")
  await page.mouse.move(box.x + box.width / 2 - 3, box.y + box.height * 0.6)
  await expect(guides).toHaveCount(1)
  await page.mouse.up()
  await expect(texts).toHaveCount(2)
  await page.keyboard.type("A drawn box lines up with the title and ends at the slide's centre", { delay: 0 })
  const drawn = await texts.last().evaluate((node) => {
    const frame = node.closest("[data-canvas-element]").getBoundingClientRect()
    return [frame.x, frame.x + frame.width]
  })
  expect(Math.abs(drawn[0] - anchor)).toBeLessThan(1)
  expect(Math.abs(drawn[1] - (box.x + box.width / 2))).toBeLessThan(1)
  await page.keyboard.press("Escape")
  await expect.poll(adds).toBe(2)
  await capture("text-drawn-snapped")
  note(
    "a Text tool drag 3 px off the title's left edge and the slide's centre snapped to both with red guides; Control let them go",
  )
}
