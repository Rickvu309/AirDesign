import { expect, test, type Page } from "@playwright/test"

test.use({ reducedMotion: "reduce" })

const screenIndexPath = "/screens"
const pageCount = 4

async function screenFaults(page: Page, screenPath: string) {
  const faults: string[] = []
  const recordPageError = (error: Error) => faults.push(`page error: ${error.message}`)
  const recordConsoleError = (message: { type(): string; text(): string }) => {
    if (message.type() === "error") faults.push(`console.error: ${message.text()}`)
  }
  page.on("pageerror", recordPageError)
  page.on("console", recordConsoleError)
  try {
    await page.goto(screenPath)
    await expect(page.locator("body :visible").first(), "visible content").toBeVisible({ timeout: 2000 })
    await expect(page.getByText("Unknown screen", { exact: true }), "Unknown screen").toHaveCount(0)
  } catch (error) {
    faults.push(String(error).split("\n")[0])
  }
  page.off("pageerror", recordPageError)
  page.off("console", recordConsoleError)
  return faults
}

test("every registered screen opens with no error", async ({ context, page }) => {
  await page.goto(screenIndexPath)
  const screenPaths = await page
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""))
  expect(screenPaths.length).toBeGreaterThan(0)

  const waiting = [...screenPaths]
  const faultsByScreen: Record<string, string[]> = {}
  const pages = [page, ...(await Promise.all(Array.from({ length: pageCount - 1 }, () => context.newPage())))]
  await Promise.all(
    pages.map(async (screenPage) => {
      for (let screenPath = waiting.shift(); screenPath !== undefined; screenPath = waiting.shift()) {
        const faults = await screenFaults(screenPage, screenPath)
        if (faults.length > 0) faultsByScreen[screenPath] = faults
      }
    }),
  )

  expect(faultsByScreen, `${Object.keys(faultsByScreen).length} of ${screenPaths.length} screens are broken`).toEqual(
    {},
  )
})
