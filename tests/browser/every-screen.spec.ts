import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { expect, type Page } from "@playwright/test"
import { test } from "./deck-test"
import { deckRoutes } from "../../apps/web/src/decks/deck-routes"
import { openScreen } from "./open-screen"

test.use({ reducedMotion: "reduce", viewport: { width: 1470, height: 923 } })

type Scanned = { findings: unknown[]; used: number[] }
type Scanner = { scan: (page: Page, options: { scope: string }) => Promise<Scanned> }
type Shard = { current: number; total: number }
type Reports = { writeReport: (root: string, name: string, shard: Shard, report: object) => void }
type Steps = { designShardOf: (env: NodeJS.ProcessEnv) => Shard }
const root = process.cwd()

const screenIndexPath = "/screens"
const notFoundScreens: ReadonlySet<string> = new Set([deckRoutes.deckNotFound, deckRoutes.addressNotFound])
const pageCount = 4
const firstLine = (error: unknown) => String(error).split("\n")[0] ?? ""

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
    if (!notFoundScreens.has(screenPath))
      await expect(page.locator("[data-not-found]"), "Page not found").toHaveCount(0)
  } catch (error) {
    faults.push(firstLine(error))
  }
  page.off("pageerror", recordPageError)
  page.off("console", recordConsoleError)
  return faults
}

test("every registered screen opens with no error", async ({ context, page }) => {
  await openScreen(page, screenIndexPath)
  const everyScreen = await page
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""))
  expect(everyScreen.length).toBeGreaterThan(0)
  const { designShardOf } = (await import(pathToFileURL(join(root, "scripts/check-steps.mjs")).href)) as Steps
  const shard = designShardOf(process.env)
  const screenPaths = everyScreen.filter((_, index) => index % shard.total === shard.current - 1)

  const waiting = [...screenPaths]
  const { scan } = (await import(
    pathToFileURL(join(root, ".agents/skills/verify-airdesign/look/scan.mjs")).href
  )) as Scanner
  const { writeReport } = (await import(pathToFileURL(join(root, "scripts/design-findings.mjs")).href)) as Reports
  const rows: { page: string; findings: unknown[] }[] = []
  const used = new Set<number>()
  const failures: { page: string; error: string }[] = []
  let scanning = 0
  const faultsByScreen: Record<string, string[]> = {}
  const pages = [page, ...(await Promise.all(Array.from({ length: pageCount - 1 }, () => context.newPage())))]
  await Promise.all(
    pages.map(async (screenPage) => {
      for (let screenPath = waiting.shift(); screenPath !== undefined; screenPath = waiting.shift()) {
        const faults = await screenFaults(screenPage, screenPath)
        if (faults.length > 0) faultsByScreen[screenPath] = faults
        const started = performance.now()
        try {
          await screenPage.evaluate(() => document.fonts.ready.then(() => undefined))
          const scanned = await scan(screenPage, { scope: screenPath })
          rows.push({ page: screenPath, findings: scanned.findings })
          for (const index of scanned.used) used.add(index)
        } catch (error) {
          failures.push({ page: screenPath, error: firstLine(error) })
        }
        scanning += performance.now() - started
      }
    }),
  )
  rows.sort((a, b) => a.page.localeCompare(b.page))
  writeReport(root, "screens", shard, { rows, used: [...used], failures, seconds: scanning / 1000 / pageCount })

  expect(faultsByScreen, `${Object.keys(faultsByScreen).length} of ${screenPaths.length} screens are broken`).toEqual(
    {},
  )
})
