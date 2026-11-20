import { expect, type Page } from "@playwright/test"
import { readSlideState } from "../../packages/document/src/index.ts"
import { undoCopy } from "../../apps/web/src/copy/undo-copy.ts"
import { forward, signInBrowser, test, type Stack } from "./api-stack"
import { decksOn } from "./deck-test"

async function serverAdds(stack: Stack, deck: string, cookie: string): Promise<number> {
  const opened = (await stack.post("/decks/open", { deck }, cookie)).json as { register: unknown }
  const state = readSlideState(opened.register)
  if (state === undefined) throw new Error("register")
  return state.order.filter((command) => command.slide === "element-add").length
}

async function slideBox(page: Page) {
  const box = await page.locator("[data-slide-paint]").first().boundingBox()
  if (box === null) throw new Error("slide")
  return box
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("text placed with the Text tool and left with no words is removed, with no undo step and no add on the server", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await decksOn(page).open()
  const slide = await slideBox(page)
  const texts = page.locator('[data-slide-paint] [contenteditable="true"]')
  const undo = page.getByRole("button", { name: undoCopy.undo, exact: true })
  await expect(texts).toHaveCount(1)
  await expect(undo).toBeDisabled()
  await page
    .locator("[data-slide-paint]")
    .first()
    .click({ position: { x: 4, y: 4 } })

  await page.keyboard.press("t")
  await page.mouse.click(slide.x + 160, slide.y + slide.height - 120)
  await expect(texts).toHaveCount(2)
  await expect(texts.last()).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(texts).toHaveCount(1)

  await page.keyboard.press("t")
  await page.mouse.click(slide.x + 300, slide.y + slide.height - 80)
  await expect(texts).toHaveCount(2)
  await expect(texts.last()).toBeFocused()
  await page.mouse.click(slide.x + slide.width - 40, slide.y + slide.height - 20)
  await expect(texts).toHaveCount(1)
  await expect(page.locator("[data-selection]")).toHaveCount(0)
  await expect(undo).toBeDisabled()
  expect(await serverAdds(stack, deck, cookie)).toBe(0)

  await page.keyboard.press("t")
  await page.mouse.click(slide.x + 160, slide.y + slide.height - 120)
  await page.keyboard.type("Saved words", { delay: 20 })
  await page.keyboard.press("Escape")
  await expect(texts).toHaveCount(2)
  await expect(texts.last()).toHaveText("Saved words")
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.text })).toBeEnabled()
  await expect.poll(() => serverAdds(stack, deck, cookie)).toBe(1)
  await page.keyboard.press("ControlOrMeta+z")
  await expect(texts.last()).toHaveText("")
  await expect(page.getByRole("button", { name: undoCopy.undoNamed["add-box"] })).toBeEnabled()
})
