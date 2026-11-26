import { expect, type Locator, type Page } from "@playwright/test"
import { creditsCopy } from "../../apps/web/src/copy/credits-copy"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { settingsCopy } from "../../apps/web/src/copy/settings-copy"

type Check = [id: string, state: string, verify: (page: Page) => Promise<void>]

async function expectOutlineHover(button: Locator) {
  const background = await button.evaluate((element) => getComputedStyle(element).backgroundColor)
  await button.hover()
  await expect(button).not.toHaveCSS("background-color", background)
}

async function expectConnectClose(page: Page) {
  const geometry = await page.getByRole("button", { name: productCopy.close, exact: true }).evaluate((button) => {
    const dialog = button.closest("[data-connect-agent]")
    const title = dialog?.querySelector("h2")?.getBoundingClientRect()
    if (title === undefined || dialog === null) throw new Error("Connection dialog title is missing")
    const box = button.getBoundingClientRect()
    const icon = button.querySelector("svg")?.getBoundingClientRect()
    if (icon === undefined) throw new Error("Connection dialog close icon is missing")
    const contentRight = dialog.getBoundingClientRect().right - parseFloat(getComputedStyle(dialog).paddingRight)
    return [box.top + box.height / 2 - (title.top + title.height / 2), icon.right - contentRight]
  })
  expect(geometry).toEqual([0, 0])
}

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
      const rows = await page.locator("[data-deck-row]").count()
      await expect(page.locator("[data-deck-row] :is([data-deck-initial], [data-deck-thumbnail])")).toHaveCount(rows)
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
  [
    "05-account-hover",
    "account-tab",
    async (page) => {
      const danger = page.getByRole("button", { name: settingsCopy.deleteAccount, exact: true })
      await expectOutlineHover(danger)
      await expect(danger).toHaveCSS("color", "rgb(185, 47, 47)")
      await expectOutlineHover(page.getByRole("button", { name: settingsCopy.signOut, exact: true }))
    },
  ],
  [
    "05-trash-hover",
    "trash-populated",
    async (page) => {
      const restore = page.getByRole("button", { name: "Restore", exact: true }).first()
      const empty = page.getByRole("button", { name: "Empty Trash", exact: true })
      await expect(restore).toHaveCSS(
        "border-radius",
        await empty.evaluate((button) => getComputedStyle(button).borderRadius),
      )
      await expectOutlineHover(restore)
      await expectOutlineHover(empty)
    },
  ],
  [
    "05-disconnect-hover",
    "agents-connected",
    async (page) => {
      await expectOutlineHover(page.getByRole("button", { name: productCopy.disconnect, exact: true }).first())
    },
  ],
  [
    "05-danger-cancel-hover",
    "account-delete-ask",
    async (page) => {
      await expectOutlineHover(page.getByRole("button", { name: productCopy.cancel, exact: true }))
    },
  ],
  [
    "05-consent-cancel-hover",
    "consent-claude",
    async (page) => {
      await expectOutlineHover(page.getByRole("button", { name: productCopy.cancel, exact: true }))
    },
  ],
  [
    "05-retry-border",
    "decks-failed",
    async (page) => {
      await expect(page.getByRole("button", { name: productCopy.payTryAgain })).toHaveCSS(
        "border-color",
        "rgb(215, 215, 214)",
      )
    },
  ],
  [
    "05-search-border",
    "decks-search-empty",
    async (page) => {
      await expect(page.getByRole("button", { name: productCopy.clearSearch })).toHaveCSS(
        "border-color",
        "rgb(215, 215, 214)",
      )
    },
  ],
  [
    "06-account-loading",
    "decks-loading",
    async (page) => {
      await expect(page.locator("[data-account-name]")).toHaveText("Verify")
    },
  ],
  [
    "06-account-failed",
    "decks-failed",
    async (page) => {
      await expect(page.locator("[data-account-name]")).toHaveText("Verify")
    },
  ],
  [
    "06-usage-loading",
    "usage-loading",
    async (page) => {
      const cards = page.locator("[data-settings-content] > section")
      await expect(page.locator("[data-account-name]")).toHaveText("Verify")
      await expect(cards.nth(1).getByRole("status")).toHaveCSS("font-size", "13px")
      const heights = await cards.evaluateAll((sections) =>
        sections.slice(0, 2).map((section) => section.getBoundingClientRect().height),
      )
      expect(heights).toEqual([111, 191])
    },
  ],
  [
    "07-consent-name",
    "consent-claude",
    async (page) => {
      await expect(page.getByText("Verify", { exact: true })).toBeVisible()
    },
  ],
  [
    "08-aira-placeholder",
    "aira-start",
    async (page) => {
      const color = await page
        .locator("[data-describe-deck] textarea")
        .evaluate((field) => getComputedStyle(field, "::placeholder").color)
      expect(color).toBe("rgb(102, 102, 102)")
    },
  ],
  ["09-connect-close-desktop", "agents-connect", expectConnectClose],
  ["09-connect-close-phone", "agents-connect-gemini-phone", expectConnectClose],
  [
    "09-connect-refresh",
    "agents-connect-done",
    async (page) => {
      await expect(page.locator("[data-settings-content]").getByText(settingsCopy.claude, { exact: true })).toBeVisible(
        {
          timeout: 3_000,
        },
      )
    },
  ],
  [
    "10-deck-title-menu",
    "deck-title-menu",
    async (page) => {
      const width = await page.getByRole("menu").evaluate((menu) => menu.getBoundingClientRect().width)
      expect(width).toBeLessThanOrEqual(120)
    },
  ],
  [
    "11-reset-button",
    "credits-reset",
    async (page) => {
      const reset = page.getByRole("button", { name: creditsCopy.reset, exact: true, includeHidden: true })
      await expect(reset).toBeEnabled()
      await expect(reset).toHaveCSS("background-color", "rgb(255, 255, 255)")
      await expect(reset).toHaveCSS("font-weight", "500")
    },
  ],
  [
    "12-reset-dialog",
    "credits-reset",
    async (page) => {
      const dialog = page.getByRole("dialog", { name: creditsCopy.confirmTitle })
      await expect(dialog).toHaveCSS("width", "400px")
      await expect(dialog.getByRole("button", { name: productCopy.cancel })).toHaveCSS("height", "36px")
      await expect(page.locator("[data-slot=dialog-overlay]")).toHaveCSS("background-color", "oklab(0 0 0 / 0.25)")
      const shadow = await dialog.evaluate((element) => getComputedStyle(element).boxShadow)
      expect(shadow).toContain("0px 24px 48px")
    },
  ],
  [
    "13-toast-centre",
    "credits-purchases",
    async (page) => {
      const offset = await page.locator("[data-sonner-toaster]").evaluate((toast) => {
        const main = document.querySelector("[data-decks-main]")?.getBoundingClientRect()
        if (main === undefined) throw new Error("Main area is missing")
        const box = toast.getBoundingClientRect()
        return box.left + box.width / 2 - (main.left + main.width / 2)
      })
      expect(Math.abs(offset)).toBeLessThan(1)
    },
  ],
]
