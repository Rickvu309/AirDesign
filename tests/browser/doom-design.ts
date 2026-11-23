import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test"
import { doomEditorCopy } from "../../apps/web/src/copy/doom-editor-copy"
import type { Stack } from "./api-stack"
import { clickSlide, landNodes, openDoomEditor, savedNode, selectedIds, type Opened } from "./doom-deck"

type Made = Parameters<typeof landNodes>[2][number]
export type Saved = Record<string, any>

export const panel = (page: Page) => page.locator("[data-design-panel]")
export const section = (page: Page, title: string) => panel(page).locator(`[data-design-section="${title}"]`)
export const painted = (page: Page, id: string) => page.locator(`[data-slide-box] [data-node="${id}"]`)
export const saved = async (stack: Stack, opened: Opened, id: string) => (await savedNode(stack, opened, id)) as Saved

export const words = (chars: string) => ({
  chars,
  spans: [],
  paras: [{}],
  style: "body",
  resize: "fixed",
  alignV: "top",
})

export async function designDoom(
  page: Page,
  context: BrowserContext,
  stack: Stack,
  made: (slide: string) => readonly Made[],
): Promise<Opened> {
  const opened = await openDoomEditor(page, context, stack)
  await page.getByRole("button", { name: doomEditorCopy.panelDesign, exact: true }).click()
  await expect(panel(page)).toBeVisible()
  const nodes = made(opened.slide)
  await landNodes(stack, opened, nodes)
  for (const node of nodes) await expect(painted(page, node.id)).toBeVisible()
  return opened
}

export async function pick(page: Page, id: string, x: number, y: number): Promise<void> {
  await clickSlide(page, x, y)
  expect(await selectedIds(page)).toEqual([id])
}

export async function typeInto(field: Locator, value: string): Promise<void> {
  await field.fill(value)
  await field.press("Enter")
}

export async function undoOnStage(page: Page): Promise<void> {
  await page.locator("[data-doom-stage]").click({ position: { x: 20, y: 20 } })
  await page.keyboard.press("ControlOrMeta+z")
}

export async function reloadDesign(page: Page): Promise<void> {
  await page.reload()
  await page.locator("[data-doom-ready]").waitFor()
  await page.getByRole("button", { name: doomEditorCopy.panelDesign, exact: true }).click()
  await expect(panel(page)).toBeVisible()
}
