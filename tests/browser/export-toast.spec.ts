import { expect, test } from "@playwright/test"
import { openFixture } from "./fixture-deck.ts"
import { store } from "./home-store.ts"

test.use({ viewport: { width: 1600, height: 1000 } })

test("Export says the file was downloaded, with its name, and the notice leaves on its own", async ({ page }) => {
  await store(page, [])
  await openFixture(page)
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export" }).click()
  expect((await download).suggestedFilename()).toBe("clean.pptx")
  const notice = page.getByText("clean.pptx downloaded", { exact: true })
  await expect(notice).toBeVisible()
  await page.clock.fastForward(6000)
  await expect(notice).toHaveCount(0)
})

test("a renamed deck is announced by its new file name", async ({ page }) => {
  await store(page, [])
  await openFixture(page)
  await page.getByRole("button", { name: "Rename deck: clean" }).click()
  await page.getByRole("textbox", { name: "Deck name" }).fill("Q3 plan")
  await page.getByRole("textbox", { name: "Deck name" }).press("Enter")
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export" }).click()
  await download
  await expect(page.getByText("Q3 plan.pptx downloaded", { exact: true })).toBeVisible()
})

test("a failed export shows the failure and no download notice", async ({ page }) => {
  await store(page, [])
  await openFixture(page)
  await page.evaluate(() => {
    HTMLAnchorElement.prototype.click = () => {
      throw new Error("blocked")
    }
  })
  await page.getByRole("button", { name: "Export" }).click()
  await expect(page.getByText("Unable to export. Your deck is unchanged.")).toBeVisible()
  await expect(page.getByText(/downloaded$/)).toHaveCount(0)
})
