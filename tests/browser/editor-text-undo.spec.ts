import { expect, type BrowserContext, type Page } from "@playwright/test"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { clickSlide, openEditor, savedNode, selectedIds, type Opened } from "./editor-deck"

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
  const opened = await openEditor(page, context, stack)
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
  await openEditor(page, context, stack)
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
  const opened = await openEditor(page, context, stack)
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

async function commitTokyo(page: Page, context: BrowserContext) {
  await page.keyboard.press("t")
  await clickSlide(page, 300, 700)
  await expect(page.locator("[data-text-editor]")).toBeFocused()
  await page.keyboard.type("Costs fall ", { delay: 10 })
  const ime = await context.newCDPSession(page)
  await ime.send("Input.imeSetComposition", { text: "と", selectionStart: 1, selectionEnd: 1 })
  await ime.send("Input.imeSetComposition", { text: "とうきょう", selectionStart: 5, selectionEnd: 5 })
  await ime.send("Input.insertText", { text: "東京" })
  await expect(page.locator("[data-text-editor]")).toHaveText("Costs fall 東京")
}

async function savedAfterLeaving(page: Page, stack: Stack, opened: Opened) {
  await page.keyboard.press("Escape")
  const [id] = await selectedIds(page)
  return expect.poll(() => charsOf(stack, opened, id ?? ""))
}

for (const held of [false, true])
  test(`undo right after an IME commit takes the commit back inside the text and the next key lands${held ? " while fonts are held" : ""}`, async ({
    page,
    context,
    stack,
  }) => {
    covers("edit-text", "undo")
    let release = () => {}
    const fonts = new Promise<void>((resolve) => {
      release = resolve
    })
    if (held)
      await page.route(
        (url) => url.pathname.endsWith(".wasm") || url.pathname.includes("/fonts/"),
        async (route) => {
          await fonts
          await route.continue()
        },
      )
    try {
      const opened = await openEditor(page, context, stack)
      await commitTokyo(page, context)
      await page.keyboard.press("ControlOrMeta+z")
      await expect(page.locator("[data-text-editor]")).toBeFocused()
      await expect(page.locator("[data-text-editor]")).toHaveText("Costs fall")
      await page.keyboard.type("Z", { delay: 10 })
      await expect(page.locator("[data-text-editor]")).toHaveText("Costs fall Z")
      release()
      await (await savedAfterLeaving(page, stack, opened)).toBe("Costs fall Z")
    } finally {
      release()
    }
  })

test("redo inside the text puts an undone IME commit back, and the next key lands after it", async ({
  page,
  context,
  stack,
}) => {
  covers("edit-text", "undo", "redo")
  const opened = await openEditor(page, context, stack)
  await commitTokyo(page, context)
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.locator("[data-text-editor]")).toHaveText("Costs fall")
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect(page.locator("[data-text-editor]")).toHaveText("Costs fall 東京")
  await page.keyboard.type("Z", { delay: 10 })
  await (await savedAfterLeaving(page, stack, opened)).toBe("Costs fall 東京Z")
})

test("undo inside the text while offline keeps the next key once the deck reconnects", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  let offline = true
  await page.route(
    (url) => url.pathname.startsWith("/doom/"),
    (route) => (offline ? route.abort("internetdisconnected") : route.fallback()),
  )
  await commitTokyo(page, context)
  await page.keyboard.press("ControlOrMeta+z")
  await page.keyboard.type("Z", { delay: 10 })
  await expect(page.locator("[data-text-editor]")).toHaveText("Costs fall Z")
  await page.keyboard.press("Escape")
  const [id] = await selectedIds(page)
  offline = false
  await expect.poll(() => charsOf(stack, opened, id ?? "")).toBe("Costs fall Z")
})

async function editTitle(page: Page) {
  await clickSlide(page, 600, 420)
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-text-editor]")).toBeFocused()
}

test("undo during an IME composition is ignored, so the committed text saves as the screen shows it", async ({
  page,
  context,
  stack,
}) => {
  covers("edit-text", "undo")
  const opened = await openEditor(page, context, stack)
  await editTitle(page)
  await page.keyboard.type("Local ", { delay: 10 })
  const ime = await context.newCDPSession(page)
  await ime.send("Input.imeSetComposition", { text: "とう", selectionStart: 2, selectionEnd: 2 })
  await page.keyboard.press("ControlOrMeta+z")
  await ime.send("Input.insertText", { text: "東京" })
  await page.keyboard.type("Z", { delay: 10 })
  await expect(page.locator("[data-text-editor]")).toHaveText("Local 東京Z")
  await page.keyboard.press("Escape")
  await expect.poll(() => charsOf(stack, opened, "s:4")).toBe("Local 東京Z")
})

test("redo with nothing left to redo inside the text keeps the text open, and the next key lands", async ({
  page,
  context,
  stack,
}) => {
  covers("edit-text", "undo", "redo")
  const opened = await openEditor(page, context, stack)
  await editTitle(page)
  await page.keyboard.type("One", { delay: 10 })
  await page.keyboard.press("ControlOrMeta+z")
  await page.keyboard.type("Two", { delay: 10 })
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect(page.locator("[data-text-editor]")).toBeFocused()
  await page.keyboard.type("Z", { delay: 10 })
  await expect(page.locator("[data-text-editor]")).toHaveText("TwoZ")
  await page.keyboard.press("Escape")
  await expect.poll(() => charsOf(stack, opened, "s:4")).toBe("TwoZ")
})

test("undo back to an empty text saves it empty while the text stays open, and leaving deletes the layer", async ({
  page,
  context,
  stack,
}) => {
  covers("tool-text", "undo")
  await page.clock.install()
  const opened = await openEditor(page, context, stack)
  await page.keyboard.press("t")
  await clickSlide(page, 300, 700)
  const editor = page.locator("[data-text-editor]")
  await expect(editor).toBeFocused()
  await page.keyboard.type("Temporary", { delay: 10 })
  const id = (await editor.evaluate((element) => element.closest("[data-node]")?.getAttribute("data-node"))) ?? ""
  await page.clock.runFor(1000)
  await expect.poll(() => charsOf(stack, opened, id)).toBe("Temporary")
  await page.keyboard.press("ControlOrMeta+z")
  await expect(editor).toBeFocused()
  await expect(editor).toHaveText("")
  await page.clock.runFor(1000)
  await expect.poll(() => charsOf(stack, opened, id)).toBe("")
  await page.keyboard.press("Escape")
  await expect.poll(async () => (await savedNode(stack, opened, id))?.parent).toBeNull()
})

test("a text edit fully undone inside the text leaves no deck undo step behind", async ({ page, context, stack }) => {
  covers("edit-text", "undo")
  await page.clock.install()
  const opened = await openEditor(page, context, stack)
  const subtitle = async () =>
    (await savedNode(stack, opened, "s:5"))?.box as { x: number; y: number; w: number; h: number }
  const subtitleX = async () => (await subtitle()).x
  const box = await subtitle()
  const before = box.x
  const title = await charsOf(stack, opened, "s:4")
  await clickSlide(page, box.x + box.w / 2, box.y + box.h / 2)
  await page.keyboard.press("ArrowRight")
  await expect.poll(subtitleX).toBe(before + 1)
  await editTitle(page)
  await page.keyboard.type("Temporary", { delay: 10 })
  await page.clock.runFor(1000)
  await expect.poll(() => charsOf(stack, opened, "s:4")).toBe("Temporary")
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.locator("[data-text-editor]")).toHaveText(title ?? "")
  await page.clock.runFor(1000)
  await expect.poll(() => charsOf(stack, opened, "s:4")).toBe(title)
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.locator("[data-text-editor]")).toHaveCount(0)
  await expect.poll(subtitleX).toBe(before)
  await expect.poll(() => charsOf(stack, opened, "s:4")).toBe(title)
})
