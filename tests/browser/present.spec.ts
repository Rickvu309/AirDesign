import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"

const fixture = join(process.cwd(), "scripts/pptx-fixtures/nasa-1d-cnn.pptx")
const notes = "Lead with the trend, then the number."

test.use({ viewport: { width: 1600, height: 1000 } })

async function opened(page: Page): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

function shown(page: Page) {
  return page.locator("[data-present-show] [data-present-slide]")
}

function current(page: Page) {
  return page.locator("[data-slide-entry][aria-current=true]")
}

test("Present shows the deck full screen, steps with the keys a presenter uses and lands where it stopped", async ({
  page,
}) => {
  await opened(page)
  await page.locator('[data-slide-entry="2"]').click()
  await page.getByRole("button", { name: "Present", exact: true }).click()
  await expect(shown(page)).toHaveAttribute("data-present-slide", "2")
  await expect(shown(page).locator("[data-thumb-paint]")).toHaveCount(1)
  const box = await shown(page).boundingBox()
  expect(box?.width).toBeGreaterThan(1500)
  expect(await page.locator("[data-editor-canvas]").evaluate((node) => node.closest("[inert]") !== null)).toBe(true)

  for (const [key, slide] of [
    ["ArrowRight", "3"],
    ["Space", "4"],
    ["ArrowLeft", "3"],
    ["PageDown", "4"],
    ["PageUp", "3"],
    ["ArrowDown", "4"],
    ["ArrowUp", "3"],
  ] as const) {
    await page.keyboard.press(key)
    await expect(shown(page)).toHaveAttribute("data-present-slide", slide)
  }

  await page.keyboard.press("1")
  await page.keyboard.press("2")
  await expect(page.locator("[data-present-go-to]")).toHaveText(/Go to slide 12/)
  await page.keyboard.press("Enter")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "12")
  await page.keyboard.press("Delete")
  await page.keyboard.press("End")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "15")
  await page.keyboard.press("ArrowRight")
  await expect(page.locator("[data-present-show]")).toContainText("End of the deck")
  await page.keyboard.press("ArrowLeft")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "15")
  await page.keyboard.press("Home")
  await shown(page).click()
  await expect(shown(page)).toHaveAttribute("data-present-slide", "2")
  await page.keyboard.press("Escape")

  await expect(page.locator("[data-present-show]")).toHaveCount(0)
  await expect(current(page)).toHaveAttribute("data-slide-entry", "2")
  await expect(page.getByRole("button", { name: "Present", exact: true })).toBeFocused()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(15)
})

test("the presenter view shows the speaker notes, the next slide and the time", async ({ page }) => {
  await opened(page)
  await page.locator('[data-slide-entry="3"]').click()
  if ((await page.getByRole("textbox", { name: "Speaker notes", exact: true }).count()) === 0)
    await page.getByRole("button", { name: "Expand speaker notes" }).click()
  await page.getByRole("textbox", { name: "Speaker notes", exact: true }).fill(notes)
  await page.locator('[data-slide-entry="2"]').click()
  await page.keyboard.press("ControlOrMeta+Enter")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "2")
  await page.keyboard.press("p")

  const presenter = page.locator("[data-presenter-view]")
  await expect(presenter).toContainText("Slide 2 of 15")
  await expect(presenter.locator('[data-present-slide="next-3"] [data-thumb-paint]')).toHaveCount(1)
  await expect(presenter.locator("[data-present-timer]")).toHaveText(/^00:0\d$/)
  await page.getByRole("button", { name: "Next slide" }).click()
  await expect(presenter).toContainText("Slide 3 of 15")
  await expect(presenter.locator("[data-present-notes]")).toContainText(notes)
  await page.getByRole("button", { name: "Stop presenting" }).click()

  await expect(presenter).toHaveCount(0)
  await expect(current(page)).toHaveAttribute("data-slide-entry", "3")
})
