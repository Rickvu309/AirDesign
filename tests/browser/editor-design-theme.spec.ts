import { expect, type Page } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import * as doom from "../../packages/doom/src/index.ts"
import { test } from "./api-stack"
import { hexes } from "./editor-design-art"
import { accent, landNodes, landProps, openEditor, otherTab, spot } from "./editor-deck"

const node = (page: Page, id: string) => page.locator(`[data-slide-box] [data-node="${id}"]`)
const undo = (page: Page) => page.keyboard.press("ControlOrMeta+z")

async function designing(
  page: Page,
  context: Parameters<typeof openEditor>[1],
  stack: Parameters<typeof openEditor>[2],
) {
  const opened = await openEditor(page, context, stack)
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  return opened
}

test("each theme picked by keyboard saves in one undo step and repaints both tabs", async ({
  page,
  context,
  stack,
}) => {
  const { packageBuild } = await import("../../scripts/package-build.mjs")
  const { themePresetById, themePresets }: typeof import("../../packages/taste/src/index.ts") = await packageBuild(
    process.cwd(),
    "@airdesign/taste",
  )
  const opened = await designing(page, context, stack)
  await landNodes(stack, opened, [
    {
      id: "t:2",
      type: "shape",
      parent: opened.slide,
      props: { box: spot(1100, 220, 520, 320), geometry: { kind: "rect" }, fills: accent },
    },
  ])
  const other = await otherTab(context, stack, opened.deck)
  await other.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()

  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const readFold = async () => {
    const answer = await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)
    const fold = doom.readFold(answer.json.fold)
    if (fold === undefined) throw new Error("No saved deck")
    return fold
  }
  const savedTheme = async () => doom.deckOf(await readFold()).theme
  const picker = page.getByRole("combobox", { name: /^Change theme/ })
  const neutral = themePresetById("neutral")!
  let current = neutral
  await expect(picker.getByText(current.name, { exact: true })).toBeVisible()
  await expect(picker.locator("[data-slot=select-value] > [aria-hidden]")).toHaveText(designCopy.themeSample)
  await picker.press("Enter")
  const options = page.getByRole("option")
  await expect(options).toHaveCount(themePresets.length)
  await expect(options.locator(":scope > :first-child > [aria-hidden=true]")).toHaveText(
    themePresets.map(() => designCopy.themeSample),
  )
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.keyboard.press("Escape")
  await expect(picker).toBeFocused()

  for (const entry of [...themePresets.filter(({ id }) => id !== neutral.id), neutral]) {
    await picker.press("Enter")
    await page.keyboard.type(entry.name)
    await expect(page.getByRole("option", { name: entry.name, exact: true })).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(picker.getByText(entry.name, { exact: true })).toBeVisible()
    await expect.poll(savedTheme).toEqual(entry.theme)
    await expect(other.getByRole("combobox", { name: designCopy.chooseTheme(entry.name) })).toBeVisible()

    const rgb = await page.evaluate((hex) => {
      const sample = document.createElement("span")
      sample.style.backgroundColor = hex
      return sample.style.backgroundColor
    }, entry.theme.colors.accent1)
    await expect(node(other, "t:2").locator('[data-paint="solid"]')).toHaveCSS("background-color", rgb)
    const thumb = page.locator('[data-slide-thumb] [data-node="t:2"] [data-paint="solid"]')
    await expect(thumb).toHaveCSS("background-color", rgb)

    await undo(page)
    await expect.poll(savedTheme).toEqual(current.theme)
    await page.keyboard.press("ControlOrMeta+Shift+z")
    await expect.poll(savedTheme).toEqual(entry.theme)
    current = entry
  }
})

test("a custom theme opens with no selection and keeps keyboard navigation", async ({ page, context, stack }) => {
  const opened = await designing(page, context, stack)
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const answer = await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)
  const fold = doom.readFold(answer.json.fold)
  const deck = [...(fold?.nodes.values() ?? [])].find((node) => "theme" in node)
  if (deck === undefined) throw new Error("No saved theme")

  const picker = page.getByRole("combobox", { name: /^Change theme/ })
  const ink = await picker.evaluate((element) => getComputedStyle(element).color)
  await landNodes(stack, opened, [
    {
      id: "t:2",
      type: "shape",
      parent: opened.slide,
      props: { box: spot(1100, 220, 520, 320), geometry: { kind: "rect" }, fills: accent },
    },
  ])
  await landProps(stack, opened, deck.id, { "theme.colors.accent1": hexes.navy })
  await expect(picker).toHaveAccessibleName(designCopy.chooseTheme(designCopy.customTheme))
  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  await expect(node(page, "t:2").locator('[data-paint="solid"]')).toHaveCSS("background-color", "rgb(31, 78, 121)")
  await expect(picker).toHaveAccessibleName(designCopy.chooseTheme(designCopy.customTheme))
  await expect(picker).toHaveCSS("color", ink)
  await picker.click()
  const list = page.getByRole("listbox")
  await expect(list).toBeVisible()
  await expect(page.locator('[data-slot="select-content"]')).toHaveCSS("outline-style", "none")
  await expect(list.getByRole("option", { selected: true })).toHaveCount(0)
  await page.keyboard.press("ArrowDown")
  await expect(list.getByRole("option").first()).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(picker).toBeFocused()
})
