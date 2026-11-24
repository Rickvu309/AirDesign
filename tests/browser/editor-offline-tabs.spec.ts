import { expect, type Page } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { forward, test } from "./api-stack"
import { clickSlide, openEditor, savedNode, selectedIds } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

async function cutOff(page: Page): Promise<{ online(): void }> {
  let offline = true
  await page.route(
    (url) => url.pathname.startsWith("/doom/"),
    (route) => (offline ? route.abort("internetdisconnected") : route.fallback()),
  )
  return {
    online() {
      offline = false
    },
  }
}

async function typeInto(page: Page, box: Box, words: string) {
  await clickSlide(page, box.x + box.w / 2, box.y + box.h / 2)
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-text-editor]")).toBeFocused()
  await page.keyboard.type(words)
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-text-editor]")).toHaveCount(0)
  await page.keyboard.press("Escape")
}

test("two tabs typing offline keep both tabs' words, and the next open sends a closed tab's words", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const title = (await savedNode(stack, opened, "s:4"))?.box as Box
  const subtitle = (await savedNode(stack, opened, "s:5"))?.box as Box
  const first = await cutOff(page)
  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  const other = await context.newPage()
  await forward(other, stack)
  const second = await cutOff(other)
  await other.goto(`/s/${opened.deck}`)
  await other.locator("[data-editor-ready]").waitFor()

  await typeInto(page, title, "First tab")
  await typeInto(other, subtitle, "Second tab")
  await typeInto(page, title, "First tab again")
  await other.close()
  first.online()
  second.online()
  const chars = async (node: string) => ((await savedNode(stack, opened, node))?.text as { chars?: string })?.chars

  await expect.poll(() => chars("s:4")).toBe("First tab again")
  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  await expect.poll(() => chars("s:5")).toBe("Second tab")
  await expect(page.locator("[data-slide-box] [data-line]").filter({ hasText: "Second tab" })).toHaveCount(1)
  expect(await chars("s:4")).toBe("First tab again")
})

test("an undo made offline over a layer another tab deletes lands the rest on reconnect, and keeps every step", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const boxOf = async (id: string) => (await savedNode(stack, opened, id))?.box as Box
  const title = await boxOf("s:4")
  const subtitle = await boxOf("s:5")
  const centre = (box: Box) => [box.x + box.w / 2, box.y + box.h / 2] as const

  await clickSlide(page, ...centre(subtitle))
  await page.keyboard.press("ArrowRight")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x + 1)
  await page.keyboard.down(shortcutCopy.chord.other.shift)
  await clickSlide(page, ...centre(title))
  await page.keyboard.up(shortcutCopy.chord.other.shift)
  await expect.poll(async () => (await selectedIds(page)).toSorted()).toEqual(["s:4", "s:5"])
  await page.keyboard.press("ArrowRight")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x + 2)
  await expect.poll(async () => (await boxOf("s:4")).x).toBe(title.x + 1)
  await page.keyboard.press("Escape")
  const other = await context.newPage()
  await forward(other, stack)
  await other.goto(`/s/${opened.deck}`)
  await other.locator("[data-editor-ready]").waitFor()

  const cut = await cutOff(page)
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.locator("[data-save-status]")).not.toHaveText(productCopy.saved)
  await clickSlide(other, ...centre(title))
  await expect.poll(() => selectedIds(other)).toEqual(["s:4"])
  await other.keyboard.press("Delete")
  await expect.poll(async () => (await savedNode(stack, opened, "s:4"))?.parent).toBeNull()
  expect((await boxOf("s:5")).x).toBe(subtitle.x + 2)

  cut.online()
  await expect.poll(async () => (await boxOf("s:5")).x, { timeout: 15_000 }).toBe(subtitle.x + 1)
  await expect(page.locator("[data-save-status]")).toHaveText(productCopy.saved)
  await expect(page.getByText(productCopy.editSetAside, { exact: true })).toHaveCount(0)
  await expect(page.locator('[data-slide-box] [data-node="s:4"]')).toHaveCount(0)

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x)
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x + 2)
  expect((await savedNode(stack, opened, "s:4"))?.parent).toBeNull()
  await other.close()
})

test("an undo of typing in the title, made offline while another tab deletes the title, leaves the name the other tab set and keeps the step below", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const boxOf = async (id: string) => (await savedNode(stack, opened, id))?.box as Box
  const nameOf = async () => (await savedNode(stack, opened, "s:1"))?.name
  const title = await boxOf("s:4")
  const subtitle = await boxOf("s:5")
  const centre = (box: Box) => [box.x + box.w / 2, box.y + box.h / 2] as const

  await clickSlide(page, ...centre(subtitle))
  await page.keyboard.press("ArrowRight")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x + 1)
  await page.keyboard.press("Escape")
  await typeInto(page, title, "Quarterly plan")
  await expect.poll(nameOf).toBe("Quarterly plan")
  const other = await context.newPage()
  await forward(other, stack)
  await other.goto(`/s/${opened.deck}`)
  await other.locator("[data-editor-ready]").waitFor()

  const cut = await cutOff(page)
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.locator("[data-save-status]")).not.toHaveText(productCopy.saved)
  await clickSlide(other, ...centre(title))
  await expect.poll(() => selectedIds(other)).toEqual(["s:4"])
  await other.keyboard.press("Delete")
  await expect.poll(async () => (await savedNode(stack, opened, "s:4"))?.parent).toBeNull()
  await expect.poll(nameOf).toBe(productCopy.blankDeck)

  await page.evaluate((aside) => {
    const seen = { aside: false }
    Object.assign(window, { seen })
    new MutationObserver(() => {
      if (document.body.innerText.includes(aside)) seen.aside = true
    }).observe(document.body, { subtree: true, childList: true, characterData: true })
  }, productCopy.editSetAside)
  cut.online()
  await expect(page.locator("[data-save-status]")).toHaveText(productCopy.saved, { timeout: 15_000 })
  await expect(page.locator('[data-slide-box] [data-node="s:4"]')).toHaveCount(0)
  expect(await nameOf()).toBe(productCopy.blankDeck)

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x)
  await expect(page.locator("[data-save-status]")).toHaveText(productCopy.saved)
  expect(await page.evaluate(() => (window as unknown as { seen: { aside: boolean } }).seen.aside)).toBe(false)
  await other.close()
})

test("an undo of typing in the title, made offline while another tab renames the deck, puts the words back, leaves the name the other tab set and keeps the step below", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const boxOf = async (id: string) => (await savedNode(stack, opened, id))?.box as Box
  const nameOf = async () => (await savedNode(stack, opened, "s:1"))?.name
  const wordsOf = async () => ((await savedNode(stack, opened, "s:4"))?.text as { chars?: string })?.chars
  const title = await boxOf("s:4")
  const subtitle = await boxOf("s:5")
  const original = await wordsOf()
  const centre = (box: Box) => [box.x + box.w / 2, box.y + box.h / 2] as const

  await clickSlide(page, ...centre(subtitle))
  await page.keyboard.press("ArrowRight")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x + 1)
  await page.keyboard.press("Escape")
  await typeInto(page, title, "Quarterly plan")
  await expect.poll(nameOf).toBe("Quarterly plan")
  const other = await context.newPage()
  await forward(other, stack)
  await other.goto(`/s/${opened.deck}`)
  await other.locator("[data-editor-ready]").waitFor()

  const cut = await cutOff(page)
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.locator("[data-save-status]")).not.toHaveText(productCopy.saved)
  await other.getByRole("button", { name: new RegExp(`^${productCopy.renameDeck}`) }).click()
  const field = other.getByRole("textbox", { name: productCopy.deckName })
  await field.fill("Board pack")
  await field.press("Enter")
  await expect.poll(nameOf).toBe("Board pack")

  await page.evaluate((aside) => {
    const seen = { aside: false }
    Object.assign(window, { seen })
    new MutationObserver(() => {
      if (document.body.innerText.includes(aside)) seen.aside = true
    }).observe(document.body, { subtree: true, childList: true, characterData: true })
  }, productCopy.editSetAside)
  cut.online()
  await expect(page.locator("[data-save-status]")).toHaveText(productCopy.saved, { timeout: 15_000 })
  await expect.poll(wordsOf).toBe(original)
  expect(await nameOf()).toBe("Board pack")
  expect(await page.evaluate(() => (window as unknown as { seen: { aside: boolean } }).seen.aside)).toBe(false)

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x)
  await expect(page.locator("[data-save-status]")).toHaveText(productCopy.saved)
  await other.close()
})
