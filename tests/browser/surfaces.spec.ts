import { expect, type Page } from "@playwright/test"
import { test } from "./deck-test"
import { deckRoutes } from "../../apps/web/src/decks/deck-routes"
import { settingsRoutes } from "../../apps/web/src/settings/settings-routes"
import { openScreen } from "./open-screen"

test.use({ reducedMotion: "reduce", viewport: { width: 1470, height: 923 } })

const canvas = "rgb(245, 245, 242)"
const white = "rgb(255, 255, 255)"

const deckScreens = [
  deckRoutes.emptyFirstVisit,
  deckRoutes.recentsGrid,
  deckRoutes.recentsList,
  deckRoutes.allDecksGrid,
  deckRoutes.allDecksList,
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
  await openScreen(page, deckRoutes.recentsGrid)
  const previews = await page.evaluate(() =>
    [...document.querySelectorAll("[data-decks-main] article")].map((card) => {
      const preview = card.lastElementChild
      return preview ? getComputedStyle(preview).backgroundColor : ""
    }),
  )
  expect(previews.length).toBeGreaterThan(0)
  for (const preview of previews) expect(preview).toBe("rgb(234, 234, 231)")
})

test("New deck is the signature fill with no border or ring around it", async ({ page }) => {
  await openScreen(page, "/screens/s31-02-decks-browse-recents-grid")
  const edge = await page
    .locator("[data-decks-header] button")
    .first()
    .evaluate((button) => {
      const style = getComputedStyle(button)
      return {
        border: style.borderTopWidth,
        fill: style.backgroundImage.startsWith("linear-gradient"),
        ring: style.boxShadow.includes("0px 0px 0px 1px"),
      }
    })
  expect(edge).toEqual({ border: "0px", fill: true, ring: false })
})

test("the sidebar keeps its icons on one line and its words on another", async ({ page }) => {
  await openScreen(page, "/screens/s31-02-decks-browse-recents-grid")
  const lefts = (selector: string) =>
    page
      .locator(`[data-decks-sidebar] ${selector}`)
      .evaluateAll((nodes) => [...new Set(nodes.map((node) => Math.round(node.getBoundingClientRect().left)))])
  const icons = await lefts("[data-sidebar-icon]")
  const labels = await lefts("[data-sidebar-label]")
  expect(await page.locator("[data-decks-sidebar] [data-sidebar-icon]").count()).toBeGreaterThanOrEqual(7)
  expect(icons).toHaveLength(1)
  expect(labels).toHaveLength(1)
  const starred = await page.locator("[data-decks-sidebar] nav[aria-labelledby] > div").evaluate((node) => {
    const range = document.createRange()
    range.selectNodeContents(node)
    return Math.round(range.getBoundingClientRect().left)
  })
  expect(starred).toBe(icons[0])
})
