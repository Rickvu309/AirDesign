import { expect, type Page } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { test } from "./api-stack"
import { clickSlide, openEditor, savedNode, type Opened } from "./editor-deck"
import type { Stack } from "./api-stack"

test.use({ viewport: { width: 1600, height: 1000 } })

type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

const editPath = async () => (await import("../../packages/catalog/src/index.ts")).doomRoutes.edit.path

async function titleBox(stack: Stack, opened: Opened): Promise<Box> {
  return (await savedNode(stack, opened, "s:4"))?.box as Box
}

async function nudge(page: Page, box: Box) {
  await clickSlide(page, box.x + box.w / 2, box.y + box.h / 2)
  await expect(page.locator("[data-selection-outline]")).toBeAttached()
  await page.keyboard.press("ArrowRight")
}

async function typeInto(page: Page, box: Box, words: string) {
  await clickSlide(page, box.x + box.w / 2, box.y + box.h / 2)
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-text-editor]")).toBeFocused()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.type(words)
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-text-editor]")).toHaveCount(0)
}

const chars = async (stack: Stack, opened: Opened) =>
  ((await savedNode(stack, opened, "s:4"))?.text as { chars?: string } | undefined)?.chars

test("an edit AirDesign cannot reach shows nothing over the canvas and saves once it lands", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const path = await editPath()
  await page.route(`**${path}`, (route) => route.abort("connectionfailed"))
  await typeInto(page, await titleBox(stack, opened), "Kept here")
  await expect(page.locator("[data-save-status]")).toHaveText(productCopy.savedUnreached)
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0)
  await page.unroute(`**${path}`)
  await expect.poll(() => chars(stack, opened), { timeout: 15_000 }).toBe("Kept here")
  await expect(page.locator("[data-save-status]")).toHaveText(productCopy.saved)
})

test("an edit made offline shows nothing over the canvas", async ({ page, context, stack }) => {
  const opened = await openEditor(page, context, stack)
  const box = await titleBox(stack, opened)
  const cut = (url: URL) => url.pathname.startsWith("/doom/")
  await page.route(cut, (route) => route.abort("internetdisconnected"))
  await context.setOffline(true)
  await typeInto(page, box, "Offline words")
  await expect(page.locator("[data-save-status]")).toHaveText(productCopy.savedOffline)
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0)
  await context.setOffline(false)
  await page.unroute(cut)
  await expect.poll(() => chars(stack, opened), { timeout: 15_000 }).toBe("Offline words")
  await expect(page.locator("[data-save-status]")).toHaveText(productCopy.saved)
})

test("an edit the server refuses after it was sent says it was set aside", async ({ page, context, stack }) => {
  const opened = await openEditor(page, context, stack)
  const path = await editPath()
  await page.route(`**${path}`, (route) =>
    route.fulfill({ json: { ok: false, refusal: "edit", refused: "stale", node: "s:4", prop: "text" } }),
  )
  const box = await titleBox(stack, opened)
  await nudge(page, box)
  await expect(page.getByText(productCopy.editSetAside, { exact: true })).toBeVisible()
  expect(((await savedNode(stack, opened, "s:4"))?.box as Box).x).toBe(box.x)
})

test("an edit refused for its size says it was too large and undone", async ({ page, context, stack }) => {
  const opened = await openEditor(page, context, stack)
  const path = await editPath()
  await page.route(`**${path}`, (route) => route.fulfill({ json: { ok: false, refusal: "size" } }))
  await nudge(page, await titleBox(stack, opened))
  await expect(page.getByText(productCopy.editSetAsideTooLarge, { exact: true })).toBeVisible()
})

test("an edit the device cannot keep while it waits to send says it is at risk", async ({ page, context, stack }) => {
  const opened = await openEditor(page, context, stack)
  const path = await editPath()
  let release: () => void = () => undefined
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route(`**${path}`, async (route) => {
    await held
    await route.fallback()
  })
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put
    Object.assign(window, { keptPut: put })
    IDBObjectStore.prototype.put = () => {
      throw new DOMException("full", "QuotaExceededError")
    }
  })
  await typeInto(page, await titleBox(stack, opened), "At risk")
  await expect(page.locator("[data-sonner-toast]")).toHaveText(productCopy.storageFailed)
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = (window as unknown as { keptPut: IDBObjectStore["put"] }).keptPut
  })
  release()
  await expect.poll(() => chars(stack, opened), { timeout: 15_000 }).toBe("At risk")
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0)
})
