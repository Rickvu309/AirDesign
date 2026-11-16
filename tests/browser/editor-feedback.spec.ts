import { expect, test } from "@playwright/test"
import { newBlankDeck } from "./new-deck"
import { holdableDevice, holdDevice, openDevice } from "./slow-device"

const titleName = /^Rename deck: /

test.beforeEach(async ({ page }) => {
  await holdableDevice(page)
  await page.goto("/")
  await newBlankDeck(page)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
})

for (const leave of ["Tab", "Shift+Tab", "click"] as const) {
  for (const draft of ["Renamed deck", ""]) {
    test(`${leave} leaves rename focus at its target with a ${draft === "" ? "refused" : "valid"} name`, async ({
      page,
    }) => {
      await page.getByRole("button", { name: titleName }).click()
      const field = page.getByRole("textbox", { name: "Deck name" })
      await field.fill(draft)
      const target =
        leave === "Shift+Tab"
          ? page.getByRole("link", { name: "Go to your decks" })
          : page.getByRole("button", { name: leave === "click" ? "Design" : "Grid", exact: true })
      if (leave === "click") await target.click()
      else await field.press(leave)
      await expect(target).toBeFocused()
      await expect(page.getByRole("button", { name: titleName })).toHaveAccessibleName(
        `Rename deck: ${draft === "" ? "Blank deck" : draft}`,
      )
    })
  }
}

for (const key of ["Enter", "Escape"] as const) {
  test(`${key} returns rename focus to the title`, async ({ page }) => {
    await page.getByRole("button", { name: titleName }).click()
    await page.getByRole("textbox", { name: "Deck name" }).fill("Renamed deck")
    await page.keyboard.press(key)
    const title = page.getByRole("button", { name: titleName })
    await expect(title).toBeFocused()
    await expect(title).toHaveAccessibleName(`Rename deck: ${key === "Enter" ? "Renamed deck" : "Blank deck"}`)
  })
}

for (const path of ["plus", "layout"] as const) {
  test(`${path} announces the inserted position after slide 1 of 3`, async ({ page }) => {
    const entries = page.locator("[data-slide-entry]")
    const add = page.getByRole("button", { name: "Add slide", exact: true })
    await add.click()
    await expect(entries).toHaveCount(2)
    await add.click()
    await expect(entries).toHaveCount(3)
    await page.locator('[data-slide-entry="1"]').click()
    await holdDevice(page)
    if (path === "plus") await add.click()
    else {
      await page.getByRole("button", { name: "Choose a layout for the new slide" }).click()
      await page.getByRole("menuitem", { name: "Blank", exact: true }).click()
    }
    await expect(entries).toHaveCount(3)
    await expect(page.getByRole("status").filter({ hasText: "Added slide" })).toHaveText("Added slide 3")
    await openDevice(page)
    await expect(entries).toHaveCount(4)
    await expect(page.locator('[data-slide-entry="2"]')).toHaveAttribute("aria-current", "true")
    await expect(page.getByRole("status").filter({ hasText: "Added slide" })).toHaveText("Added slide 2")
  })
}
