import { expect, type Locator, type Page } from "@playwright/test"
import { zoomCopy } from "../../apps/web/src/copy/product-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { currentBox, currentValue, elementId, readTextValue, type Box } from "../../packages/document/src/index.ts"
import { forward, openClean, settled, signInBrowser, test, type Stack } from "./api-stack"
import { entry, openGrid } from "./slide-grid-deck"

const node = elementId("256.2")
const start: Box = { x: 457_200, y: 457_200, cx: 5_486_400, cy: 1_828_800 }
const slideWide = 12_192_000

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

async function saved(stack: Stack, cookie: string, deck: string) {
  const { deckRoutes } = await import("../../packages/catalog/src/index.ts")
  const answer = deckRoutes.open.result((await stack.post(deckRoutes.open.path, { deck }, cookie)).json)
  if (!answer.ok) throw new Error(answer.refusal)
  return answer.register.elements[node] ?? null
}

async function savedBox(stack: Stack, cookie: string, deck: string): Promise<Box | null> {
  const register = await saved(stack, cookie, deck)
  return register === null ? null : currentBox(register)
}

async function savedText(stack: Stack, cookie: string, deck: string): Promise<string | null> {
  const register = await saved(stack, cookie, deck)
  if (register === null) return null
  return readTextValue(currentValue(register))
    .map((paragraph) => paragraph.runs.map((run) => run.text).join(""))
    .join("\n")
}

async function zoomTo(page: Page, percent: number) {
  await page.locator("[data-zoom-readout]").click()
  await page.getByRole("textbox", { name: zoomCopy.field }).fill(String(percent))
  await page.getByRole("textbox", { name: zoomCopy.field }).press("Enter")
}

async function centreOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("not laid out")
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function intoView(page: Page, target: Locator) {
  const room = await centreOf(page.locator("[data-grid-viewport]"))
  const at = await centreOf(target)
  await page.mouse.move(room.x, room.y)
  await page.mouse.wheel(at.x - room.x, at.y - room.y)
  await expect.poll(async () => Math.round((await centreOf(target)).y)).toBe(Math.round(room.y))
}

async function signedIn(page: Page, context: import("@playwright/test").BrowserContext, stack: Stack) {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openClean(page)
  await openGrid(page)
  return { cookie, deck }
}

for (const zoom of ["fit", 200] as const) {
  test(`a drag moves and a handle resizes an element in Grid at ${String(zoom)}, and the server keeps the box`, async ({
    page,
    context,
    stack,
  }) => {
    const { cookie, deck } = await signedIn(page, context, stack)
    if (zoom !== "fit") await zoomTo(page, zoom)
    const thumb = page.locator('[data-editor-grid] [data-thumb-node="256.2"]')
    await intoView(page, thumb)
    const from = await centreOf(thumb)
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(from.x + 10, from.y + 15, { steps: 4 })
    await page.mouse.move(from.x + 20, from.y + 30, { steps: 4 })
    const paint = page.locator("[data-grid-edit] [data-slide-paint]")
    await expect(paint).toHaveCount(1)
    const wide = await paint.evaluate((slide: HTMLElement) => Number.parseFloat(slide.style.width))
    const emu = (pixels: number) => Math.round((pixels * slideWide) / wide)
    await page.mouse.up()
    const moved = { ...start, x: start.x + emu(20), y: start.y + emu(30) }
    async function keptBox(expected: Box) {
      await expect
        .poll(async () => {
          const actual = await savedBox(stack, cookie, deck)
          return actual === null
            ? Infinity
            : Math.max(...(["x", "y", "cx", "cy"] as const).map((key) => Math.abs(actual[key] - expected[key])))
        })
        .toBeLessThanOrEqual(zoom === "fit" ? 1 : 0)
    }
    await keptBox(moved)
    await expect(page.locator("[data-grid-edit]")).toHaveCount(1)
    const grip = await centreOf(page.locator('[data-grid-edit] [data-grip="bottom-right"]'))
    await page.mouse.move(grip.x, grip.y)
    await page.mouse.down()
    await page.mouse.move(grip.x + 10, grip.y + 5, { steps: 4 })
    await page.mouse.move(grip.x + 20, grip.y + 10, { steps: 4 })
    await page.mouse.up()
    await keptBox({ ...moved, cx: start.cx + emu(20), cy: start.cy + emu(10) })
    if (zoom === 200) await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
  })
}

test("text typed in Grid saves and survives a reload, and Grid and Slides view undo one history", async ({
  page,
  context,
  stack,
}) => {
  const { cookie, deck } = await signedIn(page, context, stack)
  const thumb = page.locator('[data-editor-grid] [data-thumb-node="256.2"]')
  await thumb.dblclick({ force: true })
  const text = page.locator('[data-grid-edit] [contenteditable="true"]').first()
  await expect(text).toBeFocused()
  await page.keyboard.press("ControlOrMeta+a")
  await text.pressSequentially("Typed in Grid", { delay: 20 })
  await page.keyboard.press("Escape")
  await expect.poll(() => savedText(stack, cookie, deck)).toBe("Typed in Grid")
  await page.getByRole("button", { name: slideListCopy.listName, exact: true }).click()
  await page.getByRole("button", { name: undoCopy.undoNamed.text, exact: true }).click()
  await expect.poll(() => savedText(stack, cookie, deck)).toBe("Hello")
  await page.getByRole("button", { name: undoCopy.redoNamed.text, exact: true }).click()
  await expect.poll(() => savedText(stack, cookie, deck)).toBe("Typed in Grid")
  await openGrid(page)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => savedText(stack, cookie, deck)).toBe("Hello")
  await expect(thumb).toContainText("Hello")
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(() => savedText(stack, cookie, deck)).toBe("Typed in Grid")
  await page.reload()
  await settled(page)
  await openGrid(page)
  await expect(thumb).toContainText("Typed in Grid")
})
