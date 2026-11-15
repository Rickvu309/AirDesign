import { expect, test, type Locator, type Page, type Route } from "@playwright/test"
import { designing, openDeck, pendingValues, settled } from "./design-panel"
import { holdableDevice } from "./slow-device"

function looks(run: Locator): Promise<string[]> {
  return run.evaluate((node) => {
    const style = getComputedStyle(node)
    return [style.fontWeight, style.fontStyle, style.textDecorationLine]
  })
}

type Rgb = readonly number[]

function channels(css: string): Rgb {
  const canvas = document.createElement("canvas")
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (context === null) throw new Error("no canvas")
  context.fillStyle = css
  context.fillRect(0, 0, 1, 1)
  return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3)
}

function paint(button: Locator): Promise<{ background: Rgb; color: Rgb }> {
  return button.evaluate((node, read) => {
    const style = getComputedStyle(node)
    const rgb = new Function(`return ${read}`)() as (css: string) => Rgb
    return { background: rgb(style.backgroundColor), color: rgb(style.color) }
  }, channels.toString())
}

function token(page: Page, name: string): Promise<Rgb> {
  return page.evaluate(
    ([property, read]) => {
      const probe = document.createElement("i")
      probe.style.color = `var(${property})`
      document.body.append(probe)
      const css = getComputedStyle(probe).color
      probe.remove()
      const rgb = new Function(`return ${read}`)() as (css: string) => Rgb
      return rgb(css)
    },
    [name, channels.toString()] as const,
  )
}

function near(found: Rgb, wanted: Rgb): boolean {
  return found.every((value, at) => Math.abs(value - (wanted[at] ?? -9)) <= 2)
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("a toggle makes the whole element bold and italic, each change is one undo step, and a reload keeps it", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
  const panel = await designing(page, editor)
  const bold = panel.getByRole("button", { name: "Bold", exact: true })
  const italic = panel.getByRole("button", { name: "Italic", exact: true })
  const run = editor.locator("[data-run]").first()
  await expect(bold).toHaveAttribute("aria-pressed", "false")
  const offLook = await paint(bold)
  await bold.click()
  await expect.poll(() => looks(run)).toEqual(["700", "normal", "none"])
  await expect(bold).toHaveAttribute("aria-pressed", "true")
  const pressed = await token(page, "--pressed")
  const pressedText = await token(page, "--pressed-foreground")
  await expect
    .poll(async () => {
      const on = await paint(bold)
      return [near(on.background, pressed), near(on.color, pressedText)]
    })
    .toEqual([true, true])
  expect(near(pressed, offLook.background)).toBe(false)
  expect(near(pressed, await token(page, "--line"))).toBe(false)
  await italic.click()
  await expect.poll(() => looks(run)).toEqual(["700", "italic", "none"])
  await expect
    .poll(async () => (await pendingValues(page, "256.2")).map(String).join())
    .toContain('"bold":true,"italic":true')
  await page.getByRole("button", { name: "Undo text format", exact: true }).click()
  await expect.poll(() => looks(run)).toEqual(["700", "normal", "none"])
  await expect(italic).toHaveAttribute("aria-pressed", "false")
  await page.getByRole("button", { name: "Redo text format", exact: true }).click()
  await expect.poll(() => looks(run)).toEqual(["700", "italic", "none"])
  await page.reload()
  await settled(page)
  await expect.poll(() => looks(editor.locator("[data-run]").first())).toEqual(["700", "italic", "none"])
})

test("toggles clicked one after another on a slow device all land, each its own undo step", async ({ page }) => {
  await holdableDevice(page)
  await openDeck(page, "clean.pptx")
  const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
  const panel = await designing(page, editor)
  const run = editor.locator("[data-run]").first()
  await page.evaluate(() => {
    window.deviceDelay = 300
  })
  await panel.getByRole("button", { name: "Bold", exact: true }).click()
  await panel.getByRole("button", { name: "Italic", exact: true }).click()
  await panel.getByRole("button", { name: "Underline", exact: true }).click()
  await expect.poll(() => looks(run)).toEqual(["700", "italic", "underline"])
  await page.getByRole("button", { name: "Undo text format", exact: true }).click()
  await expect.poll(() => looks(run)).toEqual(["700", "italic", "none"])
})

test("toggles, undos and redos clicked while the server has not answered each paint before it answers", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
  const panel = await designing(page, editor)
  const run = editor.locator("[data-run]").first()
  const held: Route[] = []
  await page.route(/\/decks\/(open|commit)$/, (route) => {
    held.push(route)
  })
  await panel.getByRole("button", { name: "Bold", exact: true }).click()
  await expect.poll(() => looks(run)).toEqual(["700", "normal", "none"])
  await panel.getByRole("button", { name: "Italic", exact: true }).click()
  await expect.poll(() => looks(run)).toEqual(["700", "italic", "none"])
  await page.getByRole("button", { name: "Undo text format", exact: true }).click()
  await page.getByRole("button", { name: "Undo text format", exact: true }).click()
  await expect.poll(() => looks(run)).toEqual(["400", "normal", "none"])
  await page.getByRole("button", { name: "Redo text format", exact: true }).click()
  await page.getByRole("button", { name: "Redo text format", exact: true }).click()
  await expect.poll(() => looks(run)).toEqual(["700", "italic", "none"])
  expect(held.length).toBeGreaterThan(0)
  for (const route of held.splice(0)) await route.continue()
  await page.unroute(/\/decks\/(open|commit)$/)
})

test("a connector bound to a shape offers no Flip, since its route decides the direction", async ({ page }) => {
  await openDeck(page, "census-updating-spm.pptx")
  await page.locator('[data-slide-entry="10"]').click()
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const line = await page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide10.xml#26"]').boundingBox()
  if (line === null) throw new Error("no connector")
  await page.mouse.click(line.x + line.width / 2, line.y + line.height / 2)
  const panel = page.locator("[data-design-element]")
  await expect(panel.getByRole("heading", { name: "Connector", exact: true })).toBeVisible()
  await expect(panel.getByRole("group", { name: "Align", exact: true })).toBeVisible()
  await expect(panel.getByRole("button", { name: "Flip horizontally", exact: true })).toHaveCount(0)
  await expect(panel.getByRole("button", { name: "Flip vertically", exact: true })).toHaveCount(0)
})
