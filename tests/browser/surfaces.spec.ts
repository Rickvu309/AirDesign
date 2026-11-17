import { expect, test, type Page } from "@playwright/test"
import { deckRoutes } from "../../apps/web/src/decks/deck-routes"
import { settingsRoutes } from "../../apps/web/src/settings/settings-routes"

test.use({ reducedMotion: "reduce", viewport: { width: 1470, height: 923 } })

const canvas = "rgb(245, 245, 242)"
const white = "rgb(255, 255, 255)"

const deckScreens = [
  deckRoutes.emptyFirstVisit,
  deckRoutes.recentsGrid,
  deckRoutes.recentsList,
  deckRoutes.allDecksGrid,
  deckRoutes.allDecksList,
  deckRoutes.importing,
  deckRoutes.importFailed,
  deckRoutes.trash,
]

const settingsScreens = [settingsRoutes.usage, settingsRoutes.agents, settingsRoutes.account]

type Surfaces = {
  sidebar: string
  page: string
  switchGroup: string | null
  cards: { name: string; own: string; under: string }[]
}

async function surfaces(page: Page): Promise<Surfaces> {
  return page.evaluate(() => {
    const painted = (element: Element) => {
      const color = getComputedStyle(element).backgroundColor
      return color !== "rgba(0, 0, 0, 0)" && color !== "transparent"
    }
    const under = (element: Element | null): string => {
      for (let node = element; node; node = node.parentElement) {
        if (painted(node)) return getComputedStyle(node).backgroundColor
      }
      return "none"
    }
    const main = document.querySelector("[data-decks-main]")
    const sidebar = document.querySelector("[data-decks-sidebar]")
    const group = document.querySelector('[role="group"][aria-label="Layout"]')
    const listRow = (card: Element) => !painted(card) && card.hasAttribute("data-deck-row")
    const cards = [...(main?.querySelectorAll("article, section") ?? [])]
      .filter((card) => !listRow(card))
      .map((card) => ({
        name: card.querySelector("h2")?.textContent ?? "",
        own: getComputedStyle(card).backgroundColor,
        under: under(card.parentElement),
      }))
    return {
      sidebar: sidebar ? under(sidebar) : "none",
      page: under(main),
      switchGroup: group ? getComputedStyle(group).backgroundColor : null,
      cards,
    }
  })
}

for (const path of [...deckScreens, ...settingsScreens]) {
  test(`${path} paints a white page, a canvas sidebar and canvas cards`, async ({ page }) => {
    await page.goto(path)
    await expect(page.locator("[data-decks-main]")).toBeVisible()
    const seen = await surfaces(page)
    expect(seen.sidebar).toBe(canvas)
    expect(seen.page).toBe(white)
    if (seen.switchGroup !== null) expect(seen.switchGroup).toBe(canvas)
    for (const card of seen.cards) {
      expect(card.own, `${card.name} is canvas`).toBe(canvas)
      expect(card.own, `${card.name} differs from what it sits on`).not.toBe(card.under)
    }
  })
}

test("a deck card's preview box is the line colour, not the card's", async ({ page }) => {
  await page.goto(deckRoutes.recentsGrid)
  const previews = await page.evaluate(() =>
    [...document.querySelectorAll("[data-decks-main] article")].map((card) => {
      const preview = card.lastElementChild
      return preview ? getComputedStyle(preview).backgroundColor : ""
    }),
  )
  expect(previews.length).toBeGreaterThan(0)
  for (const preview of previews) expect(preview).toBe("rgb(234, 234, 231)")
})
