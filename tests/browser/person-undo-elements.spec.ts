import { presentCopy } from "../../apps/web/src/copy/present-copy.ts"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { elementGone, elementId, readSlideState } from "../../packages/document/src/index.ts"
import { forward, signInBrowser, test, type Stack } from "./api-stack"
import { holdWriteOf, holdWrites, readwrites, releaseWrite, writeHeld } from "./held-write"
import { undoCopy } from "../../apps/web/src/copy/undo-copy.ts"
import { decksOn } from "./deck-test"
import { placeText } from "./text-place"
import { openGrid } from "./slide-grid-deck"

const fixtures = join(process.cwd(), "scripts/pptx-fixtures")
const title = "ppt/slides/slide1.xml#2"
const picture = "ppt/slides/slide4.xml#6"

test.use({ viewport: { width: 1600, height: 1000 } })

async function placed(page: Page, element: string): Promise<number[]> {
  return page
    .locator(`[data-canvas-element="${element}"]`)
    .evaluate((frame: HTMLElement) =>
      [frame.style.left, frame.style.top, frame.style.width, frame.style.height].map((each) => Number.parseFloat(each)),
    )
}

async function serverOrder(stack: Stack, deck: string, cookie: string) {
  const opened = (await stack.post("/decks/open", { deck }, cookie)).json as { register: unknown }
  const state = readSlideState(opened.register)
  if (state === undefined) throw new Error("register")
  return state
}

async function open(page: Page, file: string): Promise<void> {
  await decksOn(page).open(join(fixtures, file))
}

test("a person undoes and redoes an added text box and a deleted element, and the server keeps the result", async ({
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
  const start = await placed(page, title)

  await placeText(page, { x: 0.2, y: 0.8 })
  await expect(texts).toHaveCount(2)
  await page.keyboard.type("Added", { delay: 20 })
  await expect(texts.last()).toHaveText("Added")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: "Undo text edit" })).toBeEnabled()
  await page.keyboard.press("ControlOrMeta+z")
  await expect(texts.last()).toHaveText("")
  await page.getByRole("button", { name: undoCopy.undoNamed["add-box"] }).click()
  await expect(texts).toHaveCount(1)
  await page.getByRole("button", { name: undoCopy.redoNamed["add-box"] }).click()
  await expect(texts).toHaveCount(2)
  await page.getByRole("button", { name: "Redo text edit" }).click()
  await expect(texts.last()).toHaveText("Added")

  await texts.first().click()
  await page.keyboard.press("Delete")
  await expect(texts).toHaveCount(1)
  await expect(page.getByRole("button", { name: undoCopy.undoNamed["delete-element"] })).toBeEnabled()
  await page.keyboard.press("ControlOrMeta+z")
  await expect(texts).toHaveCount(2)
  await expect(texts.first()).toHaveText("Hello")
  expect(await placed(page, title)).toEqual(start)
  await expect(page.getByRole("button", { name: undoCopy.redoNamed["delete-element"] })).toBeEnabled()

  await expect
    .poll(async () => (await serverOrder(stack, deck, cookie)).order.map((command) => command.slide))
    .toEqual(["element-add", "element-remove", "element-restore", "element-remove", "element-restore"])
  const state = await serverOrder(stack, deck, cookie)
  expect(
    state.order.some((command) => command.slide === "element-add" && !elementGone(state, command.element.node)),
  ).toBe(true)
  expect(elementGone(state, elementId("256.2"))).toBe(false)
  await page.reload()
  await decks.ready()
  await expect(texts).toHaveCount(2)
  await expect(texts.first()).toHaveText("Hello")
  await expect(texts.last()).toHaveText("Added")
})

test("one visit to the speaker notes is one undo step", async ({ page, context, stack }) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await open(page, "nasa-1d-cnn.pptx")
  await expect(page.getByRole("textbox", { name: presentCopy.notes, exact: true })).toBeVisible()
  const field = page.getByRole("textbox", { name: presentCopy.notes, exact: true })
  const before = await field.inputValue()
  await field.click()
  await field.pressSequentially(" Typed", { delay: 20 })
  await expect(field).toHaveValue(`${before} Typed`)
  await page.getByRole("button", { name: undoCopy.undoNamed.notes }).click()
  await expect(field).toHaveValue(before)
  await expect(page.getByRole("button", { name: undoCopy.redoNamed.notes })).toBeEnabled()
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled()
})

test("one visit to the speaker notes stays one undo step when a save's answer lands between two keystrokes", async ({
  page,
  context,
  stack,
}) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await holdWrites(page)
  let asked: () => void = () => undefined
  let answer: () => void = () => undefined
  const sent = new Promise<void>((resolve) => {
    asked = resolve
  })
  const answered = new Promise<void>((resolve) => {
    answer = resolve
  })
  let holding = false
  await page.route("**/decks/commit", async (route) => {
    if (holding) {
      holding = false
      asked()
      await answered
    }
    await route.fallback()
  })
  await open(page, "nasa-1d-cnn.pptx")
  const field = page.getByRole("textbox", { name: presentCopy.notes, exact: true })
  const before = await field.inputValue()
  await field.click()
  await field.pressSequentially(" Ty")
  await expect(page.locator("[data-save-status]")).toHaveAttribute("data-save-status", "saved")
  holding = true
  await field.press("p")
  await sent
  await holdWriteOf(page, `${before} Type`)
  await field.press("e")
  await writeHeld(page)
  const confirming = await readwrites(page)
  answer()
  await expect.poll(() => readwrites(page)).toBeGreaterThan(confirming)
  const typing = await readwrites(page)
  await field.press("d")
  await expect.poll(() => readwrites(page)).toBeGreaterThan(typing)
  await releaseWrite(page)
  await expect(field).toHaveValue(`${before} Typed`)
  await page.getByRole("button", { name: undoCopy.undoNamed.notes }).click()
  await expect(field).toHaveValue(before)
  await expect(page.getByRole("button", { name: undoCopy.redoNamed.notes })).toBeEnabled()
})

test("a person undoes a picture move", async ({ page, context, stack }) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await open(page, "doe-heat-pumps.pptx")
  await page.locator('[data-slide-entry="4"]').click()
  const start = await placed(page, picture)
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  if (slide === null) throw new Error("slide")
  await page.mouse.move(slide.x + 100, slide.y + 300)
  await page.mouse.down()
  await page.mouse.move(slide.x + 120, slide.y + 310, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => placed(page, picture)).not.toEqual(start)
  await page.getByRole("button", { name: "Undo move" }).click()
  await expect.poll(() => placed(page, picture)).toEqual(start)
})
