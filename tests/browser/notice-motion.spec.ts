import { productCopy } from "../../apps/web/src/copy/product-copy"
import { expect, type BrowserContext, type Page } from "@playwright/test"
import { forward, signInBrowser, test } from "./api-stack"
import { decksOn } from "./deck-test"

const offlineWords = "You're offline. Edits are saved on this device."
const unreachedWords = productCopy.editorUnreached
const undoChangedWords = "Unable to undo. This changed after your edit, so it stays as it is."

test.use({ viewport: { width: 1470, height: 923 } })

function noticeOf(page: Page, words: string) {
  return page.locator("[data-sonner-toast]", { hasText: words })
}

async function transitionOf(page: Page, words: string): Promise<string> {
  return noticeOf(page, words).evaluate((notice) => getComputedStyle(notice).transitionProperty)
}

async function pendingRows(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const all = database.transaction("rows", "readonly").objectStore("rows").getAll()
          all.onerror = () => reject(all.error)
          all.onsuccess = () => {
            database.close()
            resolve(
              (all.result as unknown[]).filter(
                (row) => typeof row === "object" && row !== null && "kind" in row && row.kind === "pending",
              ).length,
            )
          }
        }
      }),
  )
}

async function goOffline(page: Page, context: BrowserContext): Promise<void> {
  await page.route("**/decks/commit", (route) => route.abort("connectionfailed"))
  await decksOn(page).open()
  await context.setOffline(true)
  const text = page.locator('[data-slide-paint] [contenteditable="true"]')
  await text.dblclick()
  await page.keyboard.press("End")
  await text.pressSequentially("!!", { delay: 50 })
  await expect(noticeOf(page, offlineWords)).toBeVisible()
}

async function watchLeaving(page: Page): Promise<void> {
  await page.evaluate(() => {
    const seen = { removed: false }
    Object.assign(window, { noticeLeaving: seen })
    new MutationObserver((records) => {
      if (records.some((record) => record.target instanceof Element && record.target.matches('[data-removed="true"]')))
        seen.removed = true
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-removed"] })
  })
}

test("the offline notice slides in and leaves by the top edge", async ({ page, context, stack }) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await goOffline(page, context)
  expect(await transitionOf(page, offlineWords)).toContain("transform")
  await watchLeaving(page)
  await noticeOf(page, offlineWords).evaluate((notice) => notice.setAttribute("data-kept-notice", "true"))
  await context.setOffline(false)
  await expect(noticeOf(page, unreachedWords)).toHaveAttribute("data-kept-notice", "true")
  await expect(page.locator('[data-sonner-toast][data-removed="true"]')).toHaveCount(0)
  await context.setOffline(true)
  await expect(noticeOf(page, offlineWords)).toHaveAttribute("data-kept-notice", "true")
  await page.unroute("**/decks/commit")
  await context.setOffline(false)
  await expect(noticeOf(page, offlineWords)).toHaveCount(0)
  await expect(noticeOf(page, unreachedWords)).toHaveCount(0)
  expect(
    await page.evaluate(() => (window as unknown as { noticeLeaving: { removed: boolean } }).noticeLeaving.removed),
  ).toBe(true)
})

test("the offline notice shows at rest with reduced motion", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await goOffline(page, context)
  expect(await transitionOf(page, offlineWords)).toBe("none")
})
