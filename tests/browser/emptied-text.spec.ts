import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { readSlideState } from "../../packages/document/src/index.ts"
import { undoCopy } from "../../apps/web/src/copy/undo-copy.ts"
import { forward, signInBrowser, test, type Stack } from "./api-stack"
import { exportFromDialog } from "./export-dialog.ts"
import { openGrid } from "./slide-grid-deck"
import { placeText } from "./text-place"

const agentWords = JSON.stringify([{ from: 0, runs: [{ from: 0, text: "Agent words" }] }])
export const emptiedExport = "exported-emptied-text.pptx"
const noWords = JSON.stringify([{ from: 0, runs: [{ from: 0, text: "" }] }])

async function serverOrder(stack: Stack, deck: string, cookie: string): Promise<readonly string[]> {
  const opened = (await stack.post("/decks/open", { deck }, cookie)).json as { register: unknown }
  const state = readSlideState(opened.register)
  if (state === undefined) throw new Error("register")
  return state.order.map((command) => command.slide)
}

async function emptyAndLeave(page: Page, index: number) {
  const words = page.locator('[data-slide-paint] [contenteditable="true"]').nth(index)
  await words.dblclick()
  await expect(words).toBeFocused()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Backspace")
  await expect(words).toHaveText("")
  await page.keyboard.press("Escape")
}

async function watchFirstPaddings(page: Page) {
  await page.evaluate(() => {
    const first = new Map<string, string>()
    Object.assign(window, { firstPaddings: first })
    const record = (node: Node) => {
      if (!(node instanceof HTMLElement)) return
      for (const body of node.querySelectorAll("[data-slide-paint] [data-text-body]")) {
        const frame = body.closest<HTMLElement>("[data-canvas-element]")?.dataset.canvasElement
        const layer = body.parentElement
        if (frame !== undefined && layer !== null && !first.has(frame)) first.set(frame, layer.style.padding)
      }
    }
    record(document.body)
    new MutationObserver((changes) => {
      for (const change of changes) for (const added of change.addedNodes) record(added.parentElement ?? added)
    }).observe(document.body, { subtree: true, childList: true })
  })
}

function firstPaddings(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() =>
    Object.fromEntries((window as unknown as { firstPaddings: Map<string, string> }).firstPaddings),
  )
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("text whose words are all deleted is removed when left, one undo brings it back with its words, and an emptied shape with a fill stays", async ({
  page,
  context,
  stack,
  decks,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await decks.open()
  const texts = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect(texts).toHaveCount(1)
  await placeText(page, { x: 0.2, y: 0.8 })
  await page.keyboard.type("Saved words", { delay: 20 })
  await page.keyboard.press("Escape")
  await expect(texts).toHaveCount(2)
  await expect.poll(() => serverOrder(stack, deck, cookie)).toEqual(["element-add"])

  await emptyAndLeave(page, 1)
  await expect(texts).toHaveCount(1)
  await expect.poll(() => serverOrder(stack, deck, cookie)).toEqual(["element-add", "element-remove"])
  await expect(page.getByRole("button", { name: undoCopy.undoNamed["delete-element"] })).toBeEnabled()
  await page.keyboard.press("ControlOrMeta+z")
  await expect(texts).toHaveCount(2)
  await expect(texts.last()).toHaveText("Saved words")
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect(texts).toHaveCount(1)

  await emptyAndLeave(page, 0)
  await expect(texts).toHaveCount(1)
  await expect(texts.first()).toHaveText("")
})

test("text placed, typed in and emptied in one visit leaves nothing and no undo step", async ({ page, decks }) => {
  await decks.open()
  const texts = page.locator('[data-slide-paint] [contenteditable="true"]')
  await placeText(page, { x: 0.2, y: 0.8 })
  await page.keyboard.type("Gone", { delay: 20 })
  await expect(texts).toHaveCount(2)
  await expect(texts.last()).toHaveText("Gone")
  for (let left = 0; left < 4; left += 1) await page.keyboard.press("Backspace")
  await expect(texts.last()).toHaveText("")
  await page.keyboard.press("Escape")
  await expect(texts).toHaveCount(1)
  await expect(page.getByRole("button", { name: undoCopy.undo, exact: true })).toBeDisabled()
})

test("an agent's text emptied by the agent is removed, and text added from grid view or by an agent paints with no inset from its first frame", async ({
  page,
  context,
  stack,
  decks,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await decks.open()
  const texts = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect(texts).toHaveCount(1)
  await watchFirstPaddings(page)
  await expect.poll(async () => (await stack.callTool("airdesign_read_deck", { deck }, cookie)).index).toBe("ready")
  const read = await stack.callTool("airdesign_read_deck", { deck }, cookie)
  const slide = (read.slides as { id: string }[])[0]?.id
  const change = { op: "add", kind: "shape", slide, text: { value: agentWords } }
  const added = await stack.callTool("airdesign_edit_deck", { deck, base: read.revision, changes: [change] }, cookie)
  expect(added.ok).toBe(true)
  const node = (added.elements as { node: string }[])[0]
  if (node === undefined) throw new Error("added")
  await expect(texts).toHaveCount(2)
  await expect(texts.last()).toHaveText("Agent words")
  const empty = { op: "set", target: node.node, text: { value: noWords } }
  const emptied = await stack.callTool("airdesign_edit_deck", { deck, base: added.revision, changes: [empty] }, cookie)
  expect(emptied).toMatchObject({ ok: true })
  await expect(texts).toHaveCount(1)

  await openGrid(page)
  await page.locator("[data-editor-grid] [data-grid-card]").first().locator("[data-slide-number]").click()
  await page.getByRole("button", { name: "Add text", exact: true }).click()
  await expect(texts).toHaveCount(2)
  const addedPaddings = Object.entries(await firstPaddings(page)).filter(([frame]) => !frame.endsWith("#2"))
  expect(addedPaddings.length).toBeGreaterThanOrEqual(2)
  for (const [, padding] of addedPaddings) expect(padding).toBe("0px")
})

test("an export after emptied text was removed holds only the kept new text @export", async ({
  page,
  decks,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", emptiedExport)
  await rm(judged, { force: true })
  await decks.open()
  const texts = page.locator('[data-slide-paint] [contenteditable="true"]')
  await placeText(page, { x: 0.2, y: 0.6 })
  await page.keyboard.type("Kept words", { delay: 20 })
  await page.keyboard.press("Escape")
  await placeText(page, { x: 0.2, y: 0.8 })
  await page.keyboard.type("Gone words", { delay: 20 })
  await page.keyboard.press("Escape")
  await expect(texts).toHaveCount(3)
  await emptyAndLeave(page, 2)
  await expect(texts).toHaveCount(2)
  await expect(texts.last()).toHaveText("Kept words")
  const file = testInfo.outputPath(emptiedExport)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  await (await saving).saveAs(file)
  await copyFile(file, judged)
})
