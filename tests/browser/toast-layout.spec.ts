import { creditsCopy } from "../../apps/web/src/copy/credits-copy"
import { moveFailedOf, productCopy } from "../../apps/web/src/copy/product-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { expect } from "@playwright/test"
import { test } from "./deck-test"

test("a normal deck name stays whole on the trash notice", async ({ page }) => {
  await page.setViewportSize({ width: 1470, height: 923 })
  await page.goto("/screens/s33-01-decks-trash-deck-moved-toast")
  const name = "Pricing Strategy Review"
  const notice = page.locator("[data-sonner-toast]")
  await expect(notice).toContainText(`${name} moved to Trash`)
  const deck = notice.locator("bdi")
  await expect(deck).toHaveText(name)
  const cut = await deck.evaluate((element) => {
    const style = getComputedStyle(element)
    const clamp = style.webkitLineClamp !== "none" && style.webkitLineClamp !== ""
    const tall = element.scrollHeight > element.clientHeight + 1
    const wide = element.scrollWidth > element.clientWidth + 1
    return { clamp, tall, wide, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }
  })
  expect(cut.clamp ? cut.tall : cut.wide).toBe(false)
  const action = notice.locator("span").filter({ hasText: /^moved to Trash$/ })
  await expect(action).toHaveText("moved to Trash")
  const actionCut = await action.evaluate((element) => element.scrollWidth > element.clientWidth + 1)
  expect(actionCut).toBe(false)
})

test("a long deck name and the phrase after it share one left edge", async ({ page }) => {
  await page.setViewportSize({ width: 1470, height: 923 })
  await page.goto("/screens/s33-01-decks-trash-deck-moved-toast")
  const notice = page.locator("[data-sonner-toast]")
  const deck = notice.locator("bdi")
  await deck.evaluate((element) => {
    element.textContent = "Quarterly pricing review for regional leads"
  })
  const phrase = notice.locator("span").filter({ hasText: /^moved to Trash$/ })
  const [deckBox, phraseBox] = await Promise.all([deck.boundingBox(), phrase.boundingBox()])
  if (deckBox === null || phraseBox === null) throw new Error("Missing notice parts")
  expect(phraseBox.y).toBeGreaterThan(deckBox.y + deckBox.height - 1)
  expect(Math.abs(phraseBox.x - deckBox.x)).toBeLessThanOrEqual(0.5)
})

for (const width of [320, 480, 735]) {
  test(`Trash Undo and pointer Close fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 })
    await page.goto("/screens/s33-01-decks-trash-deck-moved-toast")
    const close = page.getByRole("button", { name: productCopy.close, exact: true })
    await expect(close).toBeVisible()
    for (const control of [close, page.getByRole("button", { name: undoCopy.undo, exact: true })]) {
      const box = await control.boundingBox()
      expect(box).not.toBeNull()
      if (box === null) throw new Error("Missing toast control")
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
    }
    await close.click()
    await expect(page.getByRole("button", { name: undoCopy.undo, exact: true })).toHaveCount(0)
  })
}

test("state-owned editor status stays until its owning state changes", async ({ page }) => {
  await page.clock.install()
  await page.goto("/screens/s49-02-editor-errors-offline")
  const notice = page.locator("[data-sonner-toast]")
  await expect(notice).toBeVisible()
  await expect(notice.getByRole("button", { name: productCopy.close, exact: true })).toHaveCount(0)
  await page.clock.fastForward(15000)
  await expect(notice).toBeVisible()
})

test("Trash Undo and Close dismiss by touch on a phone", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 }, hasTouch: true })
  try {
    const page = await context.newPage()
    await page.goto("/screens/s33-01-decks-trash-deck-moved-toast")
    await page.getByRole("button", { name: productCopy.close, exact: true }).tap()
    await expect(page.getByRole("button", { name: undoCopy.undo, exact: true })).toHaveCount(0)
  } finally {
    await context.close()
  }
})

test("error notices match their white pill with a light close button and give three-line errors vertical room", async ({
  page,
}) => {
  const longName = "Quarterly Pricing Strategy Review for Regional Enterprise Leads"
  await page.setViewportSize({ width: 1470, height: 923 })
  await page.route("**/account/profile", (route) =>
    route.fulfill({ json: { ok: true, account: { email: "person@example.com", name: "Person" } } }),
  )
  await page.route("**/decks/list", (route) =>
    route.fulfill({
      json: {
        ok: true,
        account: { email: "person@example.com" },
        decks: [
          {
            deck: "deck-1",
            name: longName,
            edited: "2026-11-26T00:00:00.000Z",
            created: "2026-11-26T00:00:00.000Z",
            doom: { rev: 1 },
          },
        ],
        trash: [],
      },
    }),
  )
  await page.route("**/decks/trash", (route) => route.fulfill({ status: 500, json: { ok: false } }))

  await page.goto("/")
  await page.getByRole("button", { name: `${longName} actions` }).click()
  await page.getByRole("menuitem", { name: productCopy.moveToTrash }).click()

  const failedMessage = moveFailedOf(longName)
  const text = page.getByText(failedMessage, { exact: true })
  await expect(text).toBeVisible()
  const close = page.getByRole("button", { name: productCopy.close, exact: true })
  await expect(close).toBeVisible()

  const metrics = await page.evaluate((message) => {
    const spans = [...document.querySelectorAll("[data-sonner-toast] span")]
    const label = spans.find((node) => node.textContent === message)
    const pill = label?.parentElement
    const closeButton = document.querySelector(`[data-sonner-toast] button[aria-label="Close"]`)
    if (!label || !pill || !closeButton) throw new Error("Missing error toast elements")
    const range = document.createRange()
    range.selectNodeContents(label)
    const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0)
    const textTop = Math.min(...rects.map((rect) => rect.top))
    const textBottom = Math.max(...rects.map((rect) => rect.bottom))
    const pillBox = pill.getBoundingClientRect()
    const pillStyle = getComputedStyle(pill)
    const closeStyle = getComputedStyle(closeButton)
    return {
      lines: rects.length,
      pillBg: pillStyle.backgroundColor,
      closeBg: closeStyle.backgroundColor,
      closeBorderWidth: closeStyle.borderTopWidth,
      topGap: textTop - pillBox.top,
      bottomGap: pillBox.bottom - textBottom,
      pillWidth: pillBox.width,
    }
  }, failedMessage)

  expect(metrics.pillBg).toBe("rgb(255, 255, 255)")
  expect(metrics.closeBg).toBe("rgb(255, 255, 255)")
  expect(metrics.closeBorderWidth).toBe("1px")
  expect(metrics.pillWidth).toBeLessThanOrEqual(420)
  expect(metrics.lines).toBeGreaterThanOrEqual(3)
  expect(metrics.topGap).toBeGreaterThanOrEqual(9)
  expect(metrics.bottomGap).toBeGreaterThanOrEqual(9)

  await page.setViewportSize({ width: 320, height: 700 })
  for (const control of [close, page.getByRole("button", { name: productCopy.payTryAgain, exact: true })]) {
    const box = await control.boundingBox()
    if (box === null) throw new Error("Missing error toast control")
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(320)
  }
})

test("status toasts size to their words within a sensible maximum and stay centered over main", async ({ page }) => {
  await page.setViewportSize({ width: 1470, height: 923 })
  await page.route("**/account/profile", (route) =>
    route.fulfill({ json: { ok: true, account: { email: "person@example.com", name: "Person" } } }),
  )
  await page.route("**/aira/usage", (route) =>
    route.fulfill({
      json: {
        ok: true,
        account: { email: "person@example.com" },
        usage: { used: 0, allowed: 2, resets: "2026-11-30T00:00:00.000Z" },
      },
    }),
  )
  await page.route("**/credits/read", (route) =>
    route.fulfill({ json: { ok: true, credits: { cents: 0, autoReset: false, history: [] } } }),
  )

  await page.goto("/settings/usage")
  await page.getByRole("button", { name: creditsCopy.add, exact: true }).click()
  const toast = page.locator("[data-sonner-toast]")
  await expect(toast).toContainText(creditsCopy.purchases)

  const metrics = await page.evaluate((message) => {
    const main = document.querySelector("[data-decks-main]")
    const pill = [...document.querySelectorAll("[data-sonner-toast] div")].find(
      (node) => node.textContent === message && getComputedStyle(node).backgroundColor === "rgb(34, 34, 34)",
    )
    if (!main || !pill) throw new Error("Missing status toast pill")
    const range = document.createRange()
    range.selectNodeContents(pill)
    const textBox = range.getBoundingClientRect()
    const pillBox = pill.getBoundingClientRect()
    const mainBox = main.getBoundingClientRect()
    return {
      pillWidth: pillBox.width,
      leftPad: textBox.left - pillBox.left,
      rightPad: pillBox.right - textBox.right,
      centerDelta: Math.abs(pillBox.left + pillBox.width / 2 - (mainBox.left + mainBox.width / 2)),
    }
  }, creditsCopy.purchases)

  expect(metrics.pillWidth).toBeLessThan(280)
  expect(Math.abs(metrics.rightPad - metrics.leftPad)).toBeLessThanOrEqual(2)
  expect(metrics.centerDelta).toBeLessThanOrEqual(2)
})
