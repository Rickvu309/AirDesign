import { productCopy } from "../../apps/web/src/copy/product-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { presentCopy } from "../../apps/web/src/copy/present-copy"
import { expect } from "@playwright/test"
import { store } from "./home-store.ts"
import { exportFromDialog } from "./export-dialog.ts"
import { test } from "./deck-test"

test.use({ viewport: { width: 1600, height: 1000 } })

test("Export downloads the file under the deck's name and shows no notice", async ({ page, decks }) => {
  await store(page, [])
  await decks.open()
  const download = page.waitForEvent("download")
  await exportFromDialog(page)
  expect((await download).suggestedFilename()).toBe("clean.pptx")
  await page.clock.fastForward(100)
  expect(await page.locator("[data-sonner-toast]").count()).toBe(0)
  expect(await page.getByText(/downloaded$/).count()).toBe(0)
})

test("a renamed deck downloads under its new file name and shows no notice", async ({ page, decks }) => {
  await store(page, [])
  await decks.open()
  await page.getByRole("button", { name: "Rename deck: clean" }).click()
  await page.getByRole("textbox", { name: "Deck name" }).fill("Q3 plan")
  await page.getByRole("textbox", { name: "Deck name" }).press(slideListCopy.openKey)
  const download = page.waitForEvent("download")
  await exportFromDialog(page)
  expect((await download).suggestedFilename()).toBe("Q3 plan.pptx")
  await page.clock.fastForward(100)
  expect(await page.locator("[data-sonner-toast]").count()).toBe(0)
})

test("a failed export shows the failure and no download notice", async ({ page, decks }) => {
  await store(page, [])
  await decks.open()
  await page.evaluate(() => {
    HTMLAnchorElement.prototype.click = () => {
      throw new Error("blocked")
    }
  })
  await exportFromDialog(page)
  await expect(page.getByText("Unable to export. Your deck is unchanged.")).toBeVisible()
  await expect(page.getByText(/downloaded$/)).toHaveCount(0)
})

test("notes recovery errors persist and can be dismissed by pointer and keyboard", async ({ page, decks }) => {
  await store(page, [])
  await decks.open()
  await expect(page.getByRole("textbox", { name: presentCopy.notes, exact: true })).toBeVisible()
  const notes = page.getByRole("textbox", { name: presentCopy.notes, exact: true })
  const error = page.locator("[data-sonner-toast]").filter({ hasText: "Unable to save presenter notes" })
  await notes.fill("Keep these notes ".repeat(600))
  await expect(error).toBeVisible()
  await notes.pressSequentially("More detail")
  await expect(error).toHaveCount(1)
  await page.clock.fastForward(6000)
  await expect(error).toContainText("Copy your notes, reload the deck and try again.")
  await error.getByRole("button", { name: productCopy.close, exact: true }).click()
  await expect(error).toHaveCount(0)
  await notes.fill("Keep these notes too ".repeat(600))
  await expect(error).toBeVisible()
  await error.getByRole("button", { name: productCopy.close, exact: true }).focus()
  await page.keyboard.press(slideListCopy.openKey)
  await expect(error).toHaveCount(0)
})

test("Sonner's close makes a native toast inert during its exit", async ({ page, decks }) => {
  await store(page, [])
  await decks.open()
  await expect(page.getByRole("textbox", { name: presentCopy.notes, exact: true })).toBeVisible()
  await page.getByRole("textbox", { name: presentCopy.notes, exact: true }).fill("Keep these notes ".repeat(600))
  const notice = page.locator("[data-sonner-toast]").filter({ hasText: "Unable to save presenter notes" })
  await expect(notice).toBeVisible()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await notice.getByRole("button", { name: productCopy.close, exact: true }).click()
  await page.clock.runFor(50)
  await expect(notice).toHaveCount(1)
  await expect(notice).toHaveJSProperty("inert", true)
  await expect(notice.getByRole("button")).toHaveCount(0)
})
