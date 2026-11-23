import { expect, type Page } from "@playwright/test"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { clickSlide, openDoomEditor, savedNode, type Opened } from "./doom-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

type Stack = Parameters<typeof savedNode>[0]

const charsOf = async (stack: Stack, opened: Opened, id: string) =>
  ((await savedNode(stack, opened, id))?.text as { chars?: string } | undefined)?.chars

async function typeWithPauses(page: Page, chunks: readonly string[]) {
  for (const chunk of chunks) {
    await page.keyboard.type(chunk)
    await page.clock.runFor(1000)
  }
}

test("typing with pauses in one text edit is one undo step, and redo puts all of it back", async ({
  page,
  context,
  stack,
}) => {
  covers("edit-text", "undo", "redo")
  await page.clock.install()
  const opened = await openDoomEditor(page, context, stack)
  const title = "s:4"
  const before = await charsOf(stack, opened, title)
  await clickSlide(page, 600, 420)
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-text-editor]")).toBeFocused()
  await typeWithPauses(page, ["Quarterly", " plan"])
  await expect.poll(() => charsOf(stack, opened, title)).toBe("Quarterly plan")
  await typeWithPauses(page, [" for", " the board"])
  await page.keyboard.press("Escape")
  await expect.poll(() => charsOf(stack, opened, title)).toBe("Quarterly plan for the board")

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => charsOf(stack, opened, title)).toBe(before)
  await expect(page.locator("[data-slide-box] [data-line]").filter({ hasText: "Quarterly" })).toHaveCount(0)
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(() => charsOf(stack, opened, title)).toBe("Quarterly plan for the board")
})

test("a new text layer typed with pauses goes in one undo step", async ({ page, context, stack }) => {
  covers("tool-text", "undo")
  await page.clock.install()
  await openDoomEditor(page, context, stack)
  const layers = page.locator("[data-slide-box] [data-node]")
  const count = await layers.count()
  await page.keyboard.press("t")
  await clickSlide(page, 300, 760)
  await expect(page.locator("[data-text-editor]")).toBeFocused()
  await typeWithPauses(page, ["Notes", " for", " later"])
  await page.keyboard.press("Escape")
  await expect(layers).toHaveCount(count + 1)
  await page.keyboard.press("ControlOrMeta+z")
  await expect(layers).toHaveCount(count)
})

test("presenter notes typed with pauses are one undo step once the notes lose focus", async ({
  page,
  context,
  stack,
}) => {
  await page.clock.install()
  const opened = await openDoomEditor(page, context, stack)
  const notes = page.locator("[data-notes-bar] textarea")
  const saved = async () =>
    ((await savedNode(stack, opened, opened.slide))?.notes as { chars: string } | undefined)?.chars ?? ""
  await notes.click()
  await typeWithPauses(page, ["Lead", " with", " the number"])
  await expect.poll(saved).toBe("Lead with the number")
  await clickSlide(page, 1800, 1000)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved).toBe("")
  await expect(notes).toHaveValue("")
})
