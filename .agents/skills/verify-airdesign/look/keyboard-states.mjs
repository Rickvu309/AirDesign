import { expect } from "@playwright/test"

const editor = "/screens/s42-02-editor-agent-run-complete"

async function blankDeck(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await kit.page.getByRole("button", { name: "New deck", exact: true }).click()
  await kit.page.getByRole("button", { name: "Blank deck", exact: true }).click()
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(1)
  const add = kit.page.getByRole("button", { name: "Add slide" }).first()
  await add.click()
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(2)
  await add.click()
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(3)
}

async function focusSlideList(kit) {
  await blankDeck(kit)
  await kit.page.locator('[data-slide-entry="1"]').focus()
  await kit.page.keyboard.press("ArrowDown")
  await kit.page.locator('[data-slide-entry="2"]').focus()
  await expect(kit.page.locator('[data-slide-entry="2"]')).toBeFocused()
}

async function focusToolbar(kit) {
  await blankDeck(kit)
  await kit.page.locator('[data-slide-entry="2"]').focus()
  await kit.page.keyboard.press("Shift+Tab")
  await kit.page.keyboard.press("Tab")
  for (let press = 0; press < 12; press += 1) {
    await kit.page.keyboard.press("Tab")
    const name = await kit.page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "")
    if (name === "Add text box") return
  }
  throw new Error("Add text box never took focus")
}

async function focusHome(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await expect(kit.page.getByRole("button", { name: "New deck" })).toBeVisible()
  for (let press = 0; press < 12; press += 1) {
    await kit.page.keyboard.press("Tab")
    const name = await kit.page.evaluate(() => document.activeElement?.textContent?.trim() ?? "")
    if (name === "New deck") return
  }
  throw new Error("New deck never took focus")
}

async function homeNarrow(kit, width) {
  await kit.signIn()
  await kit.page.setViewportSize({ width, height: 800 })
  await kit.page.goto("/")
  await expect(kit.page.getByRole("heading", { name: "Recents", level: 1 })).toBeVisible()
}

export const keyboardStates = [
  { name: "focus-slide-list", design: editor, drive: focusSlideList },
  { name: "focus-toolbar", design: editor, drive: focusToolbar },
  { name: "focus-home", design: null, drive: focusHome },
  { name: "home-zoomed", design: null, drive: (kit) => homeNarrow(kit, 735) },
]
