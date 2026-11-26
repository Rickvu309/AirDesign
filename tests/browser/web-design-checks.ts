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
]
