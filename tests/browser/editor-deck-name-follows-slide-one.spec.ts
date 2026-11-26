import { expect, type Page } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { test, forward, signInBrowser } from "./api-stack"
import { newDoomDeck } from "./new-deck"
import { clickSlide, savedNode, savedSlides } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const entry = (page: Page, number: number) => page.locator(`[data-slide-entry="${String(number)}"]`)

async function typeTitle(page: Page, text: string) {
  await clickSlide(page, 600, 490)
  await page.keyboard.press("Enter")
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.type(text)
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")
}

test("a deck named by its first slide's title follows the title of whichever slide is first after a reorder, a delete, Undo and Redo, and the home lists that name", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  await page.goto("/")
  await newDoomDeck(page)
  await page.locator("[data-editor-ready]").waitFor()
  const deck = new URL(page.url()).pathname.slice("/s/".length)
  const opened = { deck, cookie, slide: "s:3" }
  const deckName = async () => (await savedNode(stack, opened, "s:1"))?.name
  const slideCount = async () => (await savedSlides(stack, opened)).length

  await typeTitle(page, "Alpha")
  await expect.poll(deckName).toBe("Alpha")

  await entry(page, 1).click()
  await page.keyboard.press("ControlOrMeta+d")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect.poll(slideCount).toBe(2)
  await typeTitle(page, "Beta")
  await expect(page.locator("[data-slide-box]")).toContainText("Beta")
  expect(await deckName()).toBe("Alpha")

  await entry(page, 2).dragTo(entry(page, 1))
  await expect.poll(deckName).toBe("Beta")
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(deckName).toBe("Alpha")
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(deckName).toBe("Beta")
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(deckName).toBe("Alpha")

  await entry(page, 1).click()
  await page.keyboard.press("Delete")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await expect.poll(deckName).toBe("Beta")
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect.poll(deckName).toBe("Alpha")
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(deckName).toBe("Beta")

  await page.getByRole("link", { name: productCopy.goToDecks }).click()
  await expect(page.locator(`[data-deck="${deck}"]`).getByRole("heading")).toHaveText("Beta")
})
