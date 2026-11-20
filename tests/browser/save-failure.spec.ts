import { productCopy } from "../../apps/web/src/copy/product-copy"
import { expectNoticeTint } from "./notice-tint"
import { expect } from "@playwright/test"
import { exportFromDialog } from "./export-dialog"
import { forward, signInBrowser, test } from "./api-stack"

for (const refusal of ["storage", "size"] as const) {
  test(`${refusal} save failure shows an error and a working recovery action`, async ({
    page,
    context,
    stack,
    decks,
  }) => {
    await signInBrowser(context, await stack.signIn())
    await forward(page, stack)
    await decks.open()
    await page.route("**/decks/commit", (route) =>
      route.fulfill({ status: refusal === "size" ? 413 : 200, json: { ok: false, refusal } }),
    )
    const text = page.locator('[contenteditable="true"]')
    await text.click()
    await text.press("End")
    await text.press("x")
    const status = page.locator("[data-save-status]")
    await expect(status).toHaveText(productCopy.unsaved)
    await expect(status).toHaveCSS("width", "1px")
    await expect(status).toHaveCSS("height", "1px")
    const notice = page.locator("[data-sonner-toast]").filter({ hasText: "Unable to save." })
    await expect(notice.locator("svg")).toBeVisible()
    await expect(notice).not.toHaveCSS("background-color", "rgb(17, 17, 17)")
    if (refusal === "storage") {
      const navigated = page.waitForEvent("domcontentloaded")
      await notice.getByRole("button", { name: productCopy.reload, exact: true }).click()
      await navigated
      await expect(text).toHaveText("Hellox")
    } else {
      const download = page.waitForEvent("download")
      await notice.getByRole("button", { name: "Export", exact: true }).click()
      expect((await download).suggestedFilename()).toMatch(/\.pptx$/)
    }
  })
}

test("the offline design keeps Export available at full opacity", async ({ page }) => {
  await page.goto("/screens/s49-02-editor-errors-offline")
  const button = page.getByRole("button", { name: "Export", exact: true })
  await expect(button).toBeEnabled()
  await expect(button).toHaveCSS("opacity", "1")
})

test("an open deck exports on the device while offline", async ({ page, context, stack, decks }) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await decks.open()
  await context.setOffline(true)
  const button = page.getByRole("button", { name: "Export", exact: true })
  await expect(button).toBeEnabled()
  await expect(button).toHaveCSS("opacity", "1")
  const download = page.waitForEvent("download")
  await exportFromDialog(page)
  expect((await download).suggestedFilename()).toMatch(/\.pptx$/)
})

test("a new version uses a neutral pill with visible action feedback", async ({ page, context, stack, decks }) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await decks.open()
  await page.route("**/decks/commit", (route) => route.fulfill({ status: 200, json: { ok: false, refusal: "newer" } }))
  const text = page.locator('[contenteditable="true"]')
  await text.click()
  await text.press("End")
  await text.press("x")
  const pill = page.getByText(productCopy.newerVersion, { exact: true }).locator("..")
  await expect(pill).toHaveCSS("background-color", "rgb(34, 34, 34)")
  await expect(pill).toHaveCSS("color", "rgb(255, 255, 255)")
  await expect(pill.locator("svg")).toHaveCount(0)
  const reload = pill.getByRole("button", { name: productCopy.reload, exact: true })
  await reload.hover()
  await expectNoticeTint(reload, 26)
  await page.mouse.down()
  await expectNoticeTint(reload, 38)
  const navigated = page.waitForEvent("domcontentloaded")
  await page.mouse.up()
  await navigated
})

test("a connection interruption announces its status and keeps the notice neutral", async ({
  page,
  context,
  stack,
  decks,
}) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await decks.open()
  await page.route("**/decks/commit", (route) => route.abort("connectionfailed"))
  const text = page.locator('[contenteditable="true"]')
  await text.click()
  await text.press("End")
  await text.press("x")
  const status = page.locator("[data-save-status]")
  await expect(status).toHaveText(productCopy.savedUnreached)
  await expect(status).toHaveCSS("width", "1px")
  await expect(status).toHaveCSS("height", "1px")
  const pill = page.getByText(productCopy.editorUnreached, { exact: true }).locator("..")
  await expect(pill).toHaveCSS("background-color", "rgb(34, 34, 34)")
  await expect(pill).toHaveCSS("color", "rgb(255, 255, 255)")
  await expect(pill.locator("svg")).toHaveCount(0)
})
