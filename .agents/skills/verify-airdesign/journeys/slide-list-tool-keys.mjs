import { expect } from "@playwright/test"
import { newBlankDeck } from "../bin/new-deck.mjs"

export default async function drive({ page, signIn, post, capture, note, deckRoutes }) {
  const { cookie } = await signIn()
  await page.goto("./")
  await newBlankDeck(page)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().match(/\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const slide = page.locator("[data-slide-paint]").first()
  const layers = slide.locator("[data-canvas-element]")
  const adds = async () =>
    (await post(deckRoutes.open, { deck }, cookie)).json.register.order.filter((row) => row.slide === "element-add")
      .length

  await page.getByRole("button", { name: "Add slide", exact: true }).click()
  await expect(page.locator('[data-slide-entry="2"]')).toBeFocused()
  await expect(layers).toHaveCount(0)
  await page.keyboard.press("t")
  await expect(page.locator("[data-text-placing]")).toHaveCount(1)
  await capture("text-armed-from-slide-list")
  const box = await slide.boundingBox()
  if (box === null) throw new Error("slide")
  await page.mouse.click(box.x + box.width * 0.06, box.y + box.height * 0.1)
  await page.keyboard.type("Three levers close the gap", { delay: 10 })
  await expect(slide.locator('[contenteditable="true"]')).toHaveText("Three levers close the gap")
  await expect(layers).toHaveCount(1)
  await capture("title-typed-after-add-slide")
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")
  await expect.poll(adds).toBe(1)
  note(
    "After Add slide, focus sat on slide 2 in the list; T armed the Text tool and the typed title became one text box, not tools",
  )

  for (const [step, key] of ["r", "o", "l"].entries()) {
    await page.locator('[data-slide-entry="2"]').click()
    await page.keyboard.press(key)
    await expect(layers).toHaveCount(step + 2)
  }
  await capture("shapes-from-slide-list")
  await expect.poll(adds).toBe(4)
  note("R, O and L pressed after a click in the slide list each added one shape; the server holds 4 element-adds")
}
