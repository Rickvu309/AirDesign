import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { templatePickerCopy } from "../../apps/web/src/copy/template-picker-copy"
import { templateSlideExport } from "../../scripts/pptx-cases/deck-templates.mjs"
import { test } from "./deck-test"
import { savedExport } from "./export-dialog"
import { partsOf } from "./shape-fills"

test.use({ viewport: { width: 1600, height: 1000 } })

async function openPicker(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: productCopy.newDeck, exact: true }).click()
  await page
    .getByRole("menu", { name: productCopy.newDeck })
    .getByRole("menuitem", { name: templatePickerCopy.fromTemplate, exact: true })
    .click()
  const picker = page.locator("[data-template-picker]")
  await expect(picker.getByRole("heading", { name: templatePickerCopy.chooseTemplate })).toBeVisible()
  return picker
}

test("New deck lists Start from scratch and the three templates, each painted from its own slides", async ({
  page,
}) => {
  const picker = await openPicker(page)
  await expect(picker.locator("[data-template-scratch]")).toContainText(templatePickerCopy.startFromScratch)
  await expect(picker.locator("[data-template]")).toHaveText([/Neutral/, /Midnight/, /Editorial/])
  await expect(picker.locator("[data-template] [data-thumb-paint]")).toHaveCount(3)
  await expect(picker.locator('[data-template="midnight"] [data-thumb-paint]')).toContainText("Q3 2026 business review")
  await expect(picker.locator("[data-template]").first()).toContainText(templatePickerCopy.slideCount(6))
})

test("Add all slides starts a deck with every slide of the template", async ({ page, decks }) => {
  const picker = await openPicker(page)
  await picker.locator('[data-template="midnight"]').click()
  await expect(picker.getByRole("heading", { name: "Midnight" })).toBeVisible()
  await expect(picker.getByRole("button", { name: templatePickerCopy.backToTemplates })).toBeFocused()
  await expect(picker.locator("[data-template-slide]")).toHaveCount(6)
  await picker.getByRole("button", { name: templatePickerCopy.addAllSlides }).click()
  await decks.ready()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(6)
  await expect(page.getByRole("button", { name: /^Rename deck: Midnight/ })).toBeVisible()
})

test("a slide of a template starts a deck with that slide alone, untouched @export", async ({ page, decks }) => {
  const picker = await openPicker(page)
  await picker.locator('[data-template="editorial"]').click()
  await picker.getByRole("button", { name: templatePickerCopy.startWithSlide(3, "Editorial") }).click()
  await decks.ready()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await expect(page.locator("[data-slide-paint]").first()).toContainText(
    "Revenue grew 18% while gross margin held at 31%",
  )
  const file = join(process.cwd(), "tests/browser", templateSlideExport.exported)
  await savedExport(page, file)
  const before = await partsOf(join(process.cwd(), "packages/templates/files/editorial.pptx"))
  const after = await partsOf(file)
  expect([...after.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))).toEqual([
    templateSlideExport.part,
  ])
  expect(after.get(templateSlideExport.part)?.equals(before.get(templateSlideExport.part) ?? Buffer.alloc(0))).toBe(
    true,
  )
})

test("Start from scratch opens the doom editor and Back returns to the templates", async ({ page }) => {
  const picker = await openPicker(page)
  await picker.locator('[data-template="neutral"]').click()
  await picker.getByRole("button", { name: templatePickerCopy.backToTemplates }).click()
  await expect(picker.getByRole("heading", { name: templatePickerCopy.chooseTemplate })).toBeVisible()
  await expect(picker.locator('[data-template="neutral"]')).toBeFocused()
  await picker.locator("[data-template-scratch]").click()
  await expect(page).toHaveURL(/\/s(\/[A-Za-z0-9_-]{1,64})?$/)
})
