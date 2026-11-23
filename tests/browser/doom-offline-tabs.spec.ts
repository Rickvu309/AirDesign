import { expect, type Page } from "@playwright/test"
import { forward, test } from "./api-stack"
import { clickSlide, openDoomEditor, savedNode } from "./doom-deck"

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
  const opened = await openDoomEditor(page, context, stack)
  const title = (await savedNode(stack, opened, "s:4"))?.box as Box
  const subtitle = (await savedNode(stack, opened, "s:5"))?.box as Box
  const first = await cutOff(page)
  await page.reload()
  await page.locator("[data-doom-ready]").waitFor()
  const other = await context.newPage()
  await forward(other, stack)
  const second = await cutOff(other)
  await other.goto(`/s/${opened.deck}`)
  await other.locator("[data-doom-ready]").waitFor()

  await typeInto(page, title, "First tab")
  await typeInto(other, subtitle, "Second tab")
  await typeInto(page, title, "First tab again")
  await other.close()
  first.online()
  second.online()
  const chars = async (node: string) => ((await savedNode(stack, opened, node))?.text as { chars?: string })?.chars

  await expect.poll(() => chars("s:4")).toBe("First tab again")
  await page.reload()
  await page.locator("[data-doom-ready]").waitFor()
  await expect.poll(() => chars("s:5")).toBe("Second tab")
  await expect(page.locator("[data-slide-box] [data-line]").filter({ hasText: "Second tab" })).toHaveCount(1)
  expect(await chars("s:4")).toBe("First tab again")
})
