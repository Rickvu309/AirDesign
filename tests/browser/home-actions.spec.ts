import { expect, test } from "@playwright/test"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import {
  productCopy,
  moveFailedOf,
  noMatchTitleOf,
  movingOf,
  restoringOf,
  restoredOf,
  restoreFailedOf,
} from "../../apps/web/src/copy/product-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { first, now, store } from "./home-store.ts"

test.use({ viewport: { width: 1600, height: 1000 } })

test("an import during a search that matches nothing shows its failure above the no-results card", async ({ page }) => {
  await store(page)
  await page.goto("/?q=zebra")
  const noMatch = page.getByRole("heading", { name: noMatchTitleOf("zebra") })
  await expect(noMatch).toBeVisible()
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "broken.pptx", mimeType: "application/octet-stream", buffer: Buffer.from("broken") })
  const { importFailureWordsByReason }: typeof import("../../apps/web/src/copy/import-failure-words") = await import(
    pathToFileURL(join(process.cwd(), "apps/web/src/copy/import-failure-words.ts")).href
  )
  const refused = page.getByRole("alert")
  await expect(refused.getByText(importFailureWordsByReason.zip.title, { exact: true })).toBeVisible()
  await expect(refused.getByRole("button", { name: productCopy.importChooseAnother })).toBeFocused()
  await expect(noMatch).toBeVisible()
  const failure = await refused.boundingBox()
  const empty = await noMatch.boundingBox()
  expect(failure!.y).toBeLessThan(empty!.y)
  await page.getByRole("button", { name: productCopy.importRemove, exact: true }).click()
  await expect(page.getByRole("alert")).toHaveCount(0)
  await expect(noMatch).toBeVisible()
})

test("a move to Trash that fails says so and tries again", async ({ page }) => {
  const { calls } = await store(page, [first])
  let attempts = 0
  await page.route("**/decks/trash", (route) => {
    attempts += 1
    if (attempts === 1) return route.abort()
    if (attempts === 2) return route.fulfill({ json: { ok: false, refusal: "missing" } })
    return route.fallback()
  })
  await page.goto("/")
  await page.getByRole("button", { name: `${first.name} actions` }).click()
  await page.getByRole("menuitem", { name: productCopy.moveToTrash }).click()
  const shown = page.locator('[data-sonner-toast][data-removed="false"]')
  const failed = shown.getByText(moveFailedOf(first.name), { exact: true })
  const tryAgain = shown.getByRole("button", { name: productCopy.payTryAgain, exact: true })
  await expect(failed).toBeVisible()
  await expect(page.getByRole("heading", { name: first.name })).toBeVisible()
  await tryAgain.click()
  await expect.poll(() => attempts).toBe(2)
  await expect(failed).toHaveCount(1)
  await tryAgain.click()
  await expect(page.getByText(`${first.name} moved to Trash`, { exact: true })).toBeVisible()
  await expect(failed).toHaveCount(0)
  await expect(page.getByRole("heading", { name: first.name })).toHaveCount(0)
  expect(calls.filter((call) => call.path === "trash")).toEqual([{ path: "trash", body: { deck: "first" } }])
})

test("a dismissed retry is inert throughout the toast exit", async ({ page }) => {
  await store(page, [first])
  let attempts = 0
  const release = Promise.withResolvers<void>()
  await page.route("**/decks/trash", async (route) => {
    attempts += 1
    if (attempts === 1) return route.abort()
    if (attempts === 2) {
      await release.promise
      return route.fulfill({ json: { ok: false, refusal: "missing" } })
    }
    return route.fallback()
  })
  await page.goto("/")
  await page.getByRole("button", { name: `${first.name} actions` }).click()
  await page.getByRole("menuitem", { name: productCopy.moveToTrash }).click()
  const failed = page.locator("[data-sonner-toast]").filter({ hasText: moveFailedOf(first.name) })
  await expect(failed).toBeVisible()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  const retry = page.getByRole("button", { name: productCopy.payTryAgain, exact: true })
  await retry.click()
  await expect.poll(() => attempts).toBe(2)
  await page.clock.runFor(50)
  const leaving = page.locator('[data-sonner-toast][data-removed="true"]')
  await expect(leaving).toHaveCount(1)
  await expect(failed).toHaveCount(1)
  await expect(retry).toHaveCount(0)
  await expect(leaving).toHaveJSProperty("inert", true)
  await leaving
    .locator("button")
    .first()
    .evaluate((button) => button.focus())
  await expect(leaving.locator("button").first()).not.toBeFocused()
  release.resolve()
  await expect
    .poll(async () => {
      await page.clock.runFor(1)
      return failed.count()
    })
    .toBe(2)
  await expect(retry).toHaveCount(1)
  await expect(leaving).toHaveCount(1)
  expect(attempts).toBe(2)
})

test("Move and Restore show pending feedback until the server answers", async ({ page }) => {
  await store(page, [first])
  const release: (() => void)[] = []
  await page.route(/\/decks\/(trash|restore)$/, async (route) => {
    await new Promise<void>((resolve) => release.push(resolve))
    await route.fallback()
  })
  await page.goto("/")
  await page.getByRole("button", { name: `${first.name} actions` }).click()
  await page.getByRole("menuitem", { name: productCopy.moveToTrash }).click()
  await expect(page.getByText(movingOf(first.name), { exact: true })).toBeVisible()
  release.shift()?.()
  await page.getByRole("button", { name: undoCopy.undo, exact: true }).click()
  await expect(page.getByText(restoringOf(first.name), { exact: true })).toBeVisible()
  release.shift()?.()
  await expect(page.getByRole("heading", { name: first.name })).toBeVisible()
  await expect(page.getByText(restoredOf(first.name), { exact: true })).toBeVisible()
})

test("a failed Move can be closed and its later Undo stays until dismissed", async ({ page }) => {
  await store(page, [first])
  let refused = true
  await page.route("**/decks/trash", (route) =>
    refused ? route.fulfill({ json: { ok: false, refusal: "missing" } }) : route.fallback(),
  )
  await page.goto("/")
  const move = async () => {
    await page.getByRole("button", { name: `${first.name} actions` }).click()
    await page.getByRole("menuitem", { name: productCopy.moveToTrash }).click()
  }
  await move()
  const failed = page.locator("[data-sonner-toast]").filter({ hasText: moveFailedOf(first.name) })
  await expect(failed).toBeVisible()
  await failed.getByRole("button", { name: productCopy.close, exact: true }).click()
  await expect(failed).toHaveCount(0)
  await expect(page.getByRole("heading", { name: first.name })).toBeVisible()
  refused = false
  await move()
  const moved = page.locator("[data-sonner-toast]").filter({ hasText: `${first.name} moved to Trash` })
  await expect(moved).toBeVisible()
  await page.clock.fastForward(10000)
  await expect(moved.getByRole("button", { name: undoCopy.undo, exact: true })).toBeVisible()
  await moved.getByRole("button", { name: productCopy.close, exact: true }).focus()
  await page.keyboard.press("Enter")
  await expect(moved).toHaveCount(0)
  await expect(page.getByRole("heading", { name: first.name })).toHaveCount(0)
})

test("an Undo that fails keeps a way to restore the deck", async ({ page }) => {
  await store(page, [first])
  let attempts = 0
  await page.route("**/decks/restore", (route) => {
    attempts += 1
    return attempts === 1 ? route.fulfill({ json: { ok: false, refusal: "missing" } }) : route.fallback()
  })
  await page.goto("/")
  await page.getByRole("button", { name: `${first.name} actions` }).click()
  await page.getByRole("menuitem", { name: productCopy.moveToTrash }).click()
  await page.getByRole("button", { name: undoCopy.undo, exact: true }).click()
  const failed = page.locator("[data-sonner-toast]").getByText(restoreFailedOf(first.name), { exact: true })
  await expect(failed).toBeVisible()
  await expect(page.getByRole("heading", { name: first.name })).toHaveCount(0)
  await page.clock.fastForward(10000)
  await expect(failed).toBeVisible()
  await page.getByRole("button", { name: productCopy.payTryAgain, exact: true }).click()
  await expect(page.getByRole("heading", { name: first.name })).toBeVisible()
  await expect(failed).toHaveCount(0)
})

test("a Restore in Trash that fails says so and tries again", async ({ page }) => {
  await store(page, [], [{ ...first, trashed: now }])
  let attempts = 0
  await page.route("**/decks/restore", (route) => {
    attempts += 1
    return attempts === 1 ? route.abort() : route.fallback()
  })
  await page.goto("/trash")
  await page.getByRole("button", { name: "Restore", exact: true }).click()
  const failed = page.locator("[data-sonner-toast]").getByText(restoreFailedOf(first.name), { exact: true })
  await expect(failed).toBeVisible()
  await expect(page.getByRole("heading", { name: first.name })).toBeVisible()
  await page.getByRole("button", { name: productCopy.payTryAgain, exact: true }).click()
  await expect(page.getByRole("heading", { name: first.name })).toHaveCount(0)
  await expect(failed).toHaveCount(0)
})

test("a rapid double click on retry sends one move", async ({ page }) => {
  await store(page, [first])
  let attempts = 0
  const release = Promise.withResolvers<void>()
  await page.route("**/decks/trash", async (route) => {
    attempts += 1
    if (attempts === 1) return route.abort()
    await release.promise
    return route.fallback()
  })
  await page.goto("/")
  await page.getByRole("button", { name: `${first.name} actions` }).click()
  await page.getByRole("menuitem", { name: productCopy.moveToTrash }).click()
  const retry = page.getByRole("button", { name: productCopy.payTryAgain, exact: true })
  await expect(retry).toBeVisible()
  await retry.dblclick()
  await expect.poll(() => attempts).toBe(2)
  release.resolve()
  await expect(page.getByText(`${first.name} moved to Trash`, { exact: true })).toBeVisible()
  expect(attempts).toBe(2)
})
