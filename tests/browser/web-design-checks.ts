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
]
