import { expect, type Page } from "@playwright/test"
import * as doom from "../../packages/doom/src/index.ts"
import { airaCopy } from "../../apps/web/src/copy/aira-copy.ts"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import { test, type Stack } from "./api-stack"
import { clickSlide, openDoomEditor, selectedIds, type Opened } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 }, locale: "en-US", timezoneId: "Asia/Ho_Chi_Minh" })

async function saved(stack: Stack, opened: Opened) {
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const answer = await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)
  const fold = doom.readFold(answer.json.fold)
  if (fold === undefined) throw new Error("no fold")
  return fold
}

async function ask(page: Page, text: string) {
  await page.locator("[data-editor-panel]").getByRole("textbox", { name: airaCopy.askAira }).fill(text)
  await page.keyboard.press("Enter")
}

const textNode = (fold: doom.Doom, words: string) =>
  [...fold.nodes.values()].find((node) => (node as { text?: { chars?: string } }).text?.chars === words)

test("Undo of Aira's request keeps the layer the person moved since, says so, and takes back the rest", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openDoomEditor(page, context, stack)
  const base = (await saved(stack, opened)).rev
  const side = page.locator("[data-editor-panel]")
  const canvas = page.locator("[data-slide-box]")
  stack.aira(
    { name: "add-two-texts.sse", fill: { deck: opened.deck, base: String(base), slide: opened.slide } },
    { name: "added-two-texts.sse" },
  )
  await ask(page, "Add a summary and a note")
  await expect(canvas.getByText("Q3 summary", { exact: true })).toBeVisible()
  await expect(canvas.getByText("Draft note", { exact: true })).toBeVisible()
  await expect(side.getByRole("button", { name: "Stop" })).toHaveCount(0)
  const added = await saved(stack, opened)
  const summary = textNode(added, "Q3 summary")
  if (summary === undefined) throw new Error("no summary")
  const x = (fold: doom.Doom) => (fold.nodes.get(summary.id) as { box: { x: number } }).box.x
  const from = x(added)

  const { box } = summary as { box: { x: number; y: number; h: number } }
  await clickSlide(page, box.x + 40, box.y + box.h / 2)
  expect(await selectedIds(page)).toEqual([summary.id])
  await page.keyboard.press("Shift+ArrowRight")
  await expect.poll(async () => x(await saved(stack, opened))).toBe(from + 10)

  await side.getByRole("log").getByRole("button", { name: productCopy.undo, exact: true }).click()
  await expect(canvas.getByText("Draft note", { exact: true })).toHaveCount(0)
  await expect(canvas.getByText("Q3 summary", { exact: true })).toBeVisible()
  await expect(
    side.getByText(`${airaCopy.undone} “Q3 summary” stays, because it was changed after Aira made it.`),
  ).toBeVisible()
  await expect.poll(async () => textNode(await saved(stack, opened), "Draft note")).toMatchObject({ parent: null })
  const after = await saved(stack, opened)
  expect(x(after)).toBe(from + 10)
  expect((after.nodes.get(summary.id) as { parent: { id: string } | null }).parent?.id).toBe(opened.slide)
})
