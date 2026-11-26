import { expect, type Page } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import * as doom from "../../packages/doom/src/index.ts"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { clickSlide, openEditor, savedNode, type Opened } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

type Stack = Parameters<typeof savedNode>[0]

const title = "s:4"
const deckNode = "s:1"

const charsOf = async (stack: Stack, opened: Opened, id: string) =>
  ((await savedNode(stack, opened, id))?.text as { chars?: string } | undefined)?.chars

const deckName = async (stack: Stack, opened: Opened) => (await savedNode(stack, opened, deckNode))?.name

async function editTitle(page: Page) {
  await clickSlide(page, 600, 490)
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-text-editor]")).toBeFocused()
}

async function savedTextRev(stack: Stack, opened: Opened) {
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const answer = await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)
  return doom.readFold(answer.json.fold)?.revs.get(doom.nodeId(title))?.get("text")
}

test("a text edit fully undone inside the text still lets deck undo reach the step before it", async ({
  page,
  context,
  stack,
}) => {
  covers("edit-text", "undo")
  await page.clock.install()
  const opened = await openEditor(page, context, stack)
  const subtitle = async () =>
    (await savedNode(stack, opened, "s:5"))?.box as { x: number; y: number; w: number; h: number }
  const subtitleX = async () => (await subtitle()).x
  const box = await subtitle()
  const before = box.x
  const original = await charsOf(stack, opened, title)
  await clickSlide(page, box.x + box.w / 2, box.y + box.h / 2)
  await page.keyboard.press("ArrowRight")
  await expect.poll(subtitleX).toBe(before + 1)
  await editTitle(page)
  await page.keyboard.type("Temporary", { delay: 10 })
  await page.clock.runFor(1000)
  await expect.poll(() => charsOf(stack, opened, title)).toBe("Temporary")
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.locator("[data-text-editor]")).toHaveText(original ?? "")
  await page.clock.runFor(1000)
  await expect.poll(() => charsOf(stack, opened, title)).toBe(original)
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.locator("[data-text-editor]")).toHaveCount(0)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(subtitleX).toBe(before)
  await expect.poll(() => charsOf(stack, opened, title)).toBe(original)
})

test("deck undo after a text edit undone inside the text reaches the earlier edit of the same title", async ({
  page,
  context,
  stack,
}) => {
  covers("edit-text", "undo")
  await page.clock.install()
  const opened = await openEditor(page, context, stack)
  const original = await charsOf(stack, opened, title)
  const editor = page.locator("[data-text-editor]")
  await editTitle(page)
  await page.keyboard.type("First", { delay: 10 })
  await page.keyboard.press("Escape")
  await expect.poll(() => charsOf(stack, opened, title)).toBe("First")
  await page.keyboard.press("Enter")
  await expect(editor).toBeFocused()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.type("Temporary", { delay: 10 })
  await page.clock.runFor(1000)
  await expect.poll(() => charsOf(stack, opened, title)).toBe("Temporary")
  await page.keyboard.press("ControlOrMeta+z")
  await expect(editor).toHaveText("First")
  await page.clock.runFor(1000)
  await expect.poll(() => charsOf(stack, opened, title)).toBe("First")
  await page.keyboard.press("ControlOrMeta+z")
  await expect(editor).toHaveCount(0)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => charsOf(stack, opened, title)).toBe(original)
})

test("an undo inside the text refused after an agent wrote the title still leaves the deck name it changed undoable", async ({
  page,
  context,
  stack,
}) => {
  covers("edit-text", "undo")
  await page.clock.install()
  const opened = await openEditor(page, context, stack)
  let release = () => {}
  let held: Promise<void> | null = null
  await page.route(
    (url) => url.pathname === "/doom/since",
    async (route) => {
      const { pathname, search } = new URL(route.request().url())
      const response = await route.fetch({ url: `${stack.origin}${pathname}${search}` })
      if (held !== null) await held
      await route.fulfill({ response })
    },
  )
  const original = await charsOf(stack, opened, title)
  const name = await deckName(stack, opened)
  const editor = page.locator("[data-text-editor]")
  await editTitle(page)
  await page.keyboard.type("Temporary", { delay: 10 })
  await page.clock.runFor(1000)
  await expect.poll(() => charsOf(stack, opened, title)).toBe("Temporary")
  await expect.poll(() => deckName(stack, opened)).toBe("Temporary")

  held = new Promise((resolve) => {
    release = resolve
  })
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const run = {
    once: "agent-title",
    author: { kind: "agent", id: "helper", run: "run-title" },
    phase: "start",
    writes: [
      {
        node: title,
        prop: "text",
        value: doom.textFromMarkdown("Revenue doubled", "title"),
        base: await savedTextRev(stack, opened),
      },
    ],
  }
  expect((await stack.post(doomRoutes.edit.path, { deck: opened.deck, edit: run }, opened.cookie)).json.ok).toBe(true)
  const reversal = page.waitForResponse(
    (response) =>
      response.url().endsWith(doomRoutes.edit.path) && response.request().postData()?.includes(original!) === true,
  )
  await page.keyboard.press("ControlOrMeta+z")
  await expect(editor).toHaveText(original ?? "")
  await page.clock.runFor(1000)
  expect(await (await reversal).json()).toMatchObject({ ok: false, refused: "stale" })
  held = null
  release()
  await expect(page.getByText(productCopy.textRefused, { exact: true })).toBeVisible()
  await expect(editor).toHaveText(original ?? "")

  await page.keyboard.press("Escape")
  await expect(editor).toHaveCount(0)
  await expect.poll(() => charsOf(stack, opened, title)).toBe(original)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => deckName(stack, opened)).toBe(name)
  expect(await charsOf(stack, opened, title)).toBe(original)
  await page.unrouteAll({ behavior: "ignoreErrors" })
})
