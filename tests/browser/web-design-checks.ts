import { expect, type Page } from "@playwright/test"

type Check = [id: string, state: string, verify: (page: Page) => Promise<void>]

export const webDesignChecks: Check[] = [
  [
    "01-trash-icon",
    "decks-populated",
    async (page) => {
      await expect(page.getByRole("link", { name: "Trash", exact: true }).locator("svg path").first()).toHaveCSS(
        "fill-rule",
        "evenodd",
      )
    },
  ],
  [
    "02-agent-promo",
    "decks-populated",
    async (page) => {
      const promo = page.locator("[data-decks-sidebar] section")
      const insets = await promo.evaluate((element) => {
        const sidebar = element.closest("[data-decks-sidebar]")?.getBoundingClientRect()
        const card = element.getBoundingClientRect()
        if (sidebar === undefined) throw new Error("Sidebar is missing")
        return [card.left - sidebar.left, sidebar.right - card.right]
      })
      expect(insets).toEqual([12, 12])
    },
  ],
  [
    "03-settings-divider",
    "account-tab",
    async (page) => {
      const geometry = await page.locator("[data-settings-header]").evaluate((header) => {
        const sidebar = document.querySelector("[data-decks-sidebar]")?.getBoundingClientRect()
        const box = header.getBoundingClientRect()
        return [
          box.left - (sidebar?.right ?? 0),
          innerWidth - box.right,
          header.parentElement?.getBoundingClientRect().top,
        ]
      })
      expect(geometry).toEqual([0, 0, 0])
    },
  ],
  [
    "04-deck-list-preview",
    "decks-list",
    async (page) => {
      await expect(page.locator("[data-deck-row] [data-deck-initial]").first()).toBeVisible()
    },
  ],
  [
    "04-list-skeleton",
    "decks-list-loading",
    async (page) => {
      const row = page.locator("[data-loading] > [aria-hidden=true]").first()
      const layout = await row.evaluate((element) => [
        element.getBoundingClientRect().height,
        getComputedStyle(element).gridTemplateColumns.split(" ").length,
        element.children.length,
      ])
      expect(layout).toEqual([64, 4, 4])
    },
  ],
  [
    "04-grid-skeleton",
    "decks-loading",
    async (page) => {
      await expect(page.locator("[data-loading] article")).toHaveCount(4)
    },
  ],
]
