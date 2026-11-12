import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { store } from "./home-store.ts"

const fixture = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")

test.use({ viewport: { width: 1600, height: 1000 } })

async function open(page: Page): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator(".thin-page[data-deck-ready]")).toBeVisible()
  await expect(page.getByRole("button", { name: "Rename deck: clean" })).toBeVisible()
}

const title = (page: Page) => page.getByRole("button", { name: /^Rename deck: / })
const field = (page: Page) => page.getByRole("textbox", { name: "Deck name" })

test("clicking the title renames the deck in place and Enter saves it everywhere", async ({ page }) => {
  const { calls } = await store(page, [])
  await open(page)
  await page.getByRole("button", { name: "Rename deck: clean" }).click()
  await expect(field(page)).toBeFocused()
  await field(page).fill("Quarterly plan")
  await field(page).press("Enter")
  await expect(title(page)).toHaveAccessibleName("Rename deck: Quarterly plan")
  await expect(title(page)).toBeFocused()
  await expect(page).toHaveTitle("Quarterly plan - AirDesign")
  const id = page.url().split("/").at(-1)
  await expect
    .poll(() => calls.filter((call) => call.path === "rename").at(-1)?.body)
    .toEqual({ deck: id, name: "Quarterly plan" })
  await page.reload()
  await expect(title(page)).toHaveAccessibleName("Rename deck: Quarterly plan")
})

test("the new name is the exported file's name", async ({ page }) => {
  await store(page, [])
  await open(page)
  await title(page).click()
  await field(page).fill("Quarterly plan")
  await field(page).press("Enter")
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export" }).click()
  expect((await download).suggestedFilename()).toBe("Quarterly plan.pptx")
})

test("Escape leaves the name as it was", async ({ page }) => {
  const { calls } = await store(page, [])
  await open(page)
  await title(page).click()
  await field(page).fill("Not saved")
  await field(page).press("Escape")
  await expect(title(page)).toHaveAccessibleName("Rename deck: clean")
  await expect(page).toHaveTitle(/^clean - AirDesign$/)
  expect(calls.filter((call) => call.path === "rename" && call.body.name === "Not saved")).toEqual([])
})

test("an empty or too long name is refused with words, and the field stays open", async ({ page }) => {
  await store(page, [])
  await open(page)
  await title(page).click()
  await field(page).fill("   ")
  await field(page).press("Enter")
  await expect(page.getByRole("alert")).toHaveText("Enter a name for this deck.")
  await expect(field(page)).toBeFocused()
  await field(page).fill("a".repeat(201))
  await field(page).press("Enter")
  await expect(page.getByRole("alert")).toHaveText("Use 200 characters or fewer.")
  await field(page).fill("a".repeat(200))
  await expect(page.getByRole("alert")).toHaveCount(0)
  await field(page).press("Enter")
  await expect(title(page)).toHaveAccessibleName(`Rename deck: ${"a".repeat(200)}`)
})

test("leaving the field saves a valid name and drops an invalid one", async ({ page }) => {
  await store(page, [])
  await open(page)
  await title(page).click()
  await field(page).fill("By clicking away")
  await page.locator("[data-editor-canvas]").click({ position: { x: 5, y: 5 } })
  await expect(title(page)).toHaveAccessibleName("Rename deck: By clicking away")
  await title(page).click()
  await field(page).fill("")
  await page.locator("[data-editor-canvas]").click({ position: { x: 5, y: 5 } })
  await expect(title(page)).toHaveAccessibleName("Rename deck: By clicking away")
})

test("a rename made offline reaches the server once the network is back", async ({ page, context }) => {
  const { calls } = await store(page, [])
  await open(page)
  await context.setOffline(true)
  await title(page).click()
  await field(page).fill("Made offline")
  await field(page).press("Enter")
  await expect(title(page)).toHaveAccessibleName("Rename deck: Made offline")
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event("online")))
  await expect.poll(() => calls.filter((call) => call.path === "rename").at(-1)?.body.name).toBe("Made offline")
})

test("the deck home shows the new name", async ({ page }) => {
  await store(page, [])
  await open(page)
  await title(page).click()
  await field(page).fill("Shown at home")
  await field(page).press("Enter")
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Shown at home" })).toBeVisible()
})
