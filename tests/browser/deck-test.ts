import { join } from "node:path"
import { expect, test as base, type Locator, type Page } from "@playwright/test"
import { watchDeckState, type DeckState } from "./deck-state"
import { newBlankDeck } from "./new-deck"

export const cleanFixture = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")
export const readyMark = "data-deck-ready"

type DeckFile = Parameters<Locator["setInputFiles"]>[0]

export type Decks = {
  readonly open: (file?: DeckFile) => Promise<string>
  readonly openHeld: (file?: DeckFile) => Promise<string>
  readonly blank: () => Promise<string>
  readonly ready: () => Promise<string>
  readonly readiness: () => Promise<string | null>
}

export function decksOn(page: Page): Decks {
  const ready = async () => {
    const handle = await page.waitForFunction((mark) => {
      const shown = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
      const marked = document.querySelector(".thin-page")?.getAttribute(mark)
      return shown !== undefined && marked === shown ? shown : false
    }, readyMark)
    return (await handle.jsonValue()) as string
  }
  return {
    ready,
    async open(file: DeckFile = cleanFixture) {
      await page.goto("/")
      await page.locator("input[type=file]").setInputFiles(file)
      return ready()
    },
    async openHeld(file: DeckFile = cleanFixture) {
      await page.goto("/")
      await page.locator("input[type=file]").setInputFiles(file)
      await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
      await expect(page.locator("[data-slide-paint]")).toBeVisible()
      return new URL(page.url()).pathname.slice("/deck/".length)
    },
    async blank() {
      await page.goto("/")
      await newBlankDeck(page)
      return ready()
    },
    readiness: () =>
      page.evaluate((mark) => document.querySelector(".thin-page")?.getAttribute(mark) ?? null, readyMark),
  }
}

export const test = base.extend<{ decks: Decks; deckState: DeckState }>({
  deckState: [
    async ({ context }, use, testInfo) => {
      const state = await watchDeckState(context)
      await use(state)
      if (testInfo.status !== testInfo.expectedStatus) await state.attach(testInfo)
    },
    { auto: true },
  ],
  decks: async ({ page }, use) => {
    await use(decksOn(page))
  },
})

export { expect }
