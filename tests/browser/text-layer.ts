import { expect, type Page } from "@playwright/test"
import { clickSlide, landNodes, savedNode, spot, type Opened } from "./doom-deck"

export type Stack = Parameters<typeof savedNode>[0]

export const layer = (chars: string) => ({
  box: spot(200, 600, 800, 300),
  text: {
    chars,
    spans: [],
    paras: chars.split("\n").map(() => ({})),
    style: "body",
    resize: "fixed",
    alignV: "top",
  },
})

export async function seeded(page: Page, stack: Stack, opened: Opened, chars: string) {
  await landNodes(stack, opened, [{ id: "t:1", type: "shape", parent: opened.slide, props: layer(chars) }])
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(3)
  await clickSlide(page, 300, 640)
}

export type Saved = {
  chars: string
  spans: { end: number; italic?: boolean; underline?: boolean; strike?: boolean; link?: string }[]
  paras: { align?: string; list?: string; level?: number }[]
}

export const textOf = async (stack: Stack, opened: Opened) =>
  (await savedNode(stack, opened, "t:1"))?.text as Saved | undefined
export const runs = (page: Page) => page.locator('[data-slide-box] [data-node="t:1"] [data-run]')
export const lines = (page: Page) => page.locator('[data-slide-box] [data-node="t:1"] [data-line]')
export const labels = (page: Page) => page.locator('[data-slide-box] [data-node="t:1"] [data-label]')
export const editor = (page: Page) => page.locator("[data-text-editor]")

export async function edit(page: Page) {
  await page.keyboard.press("Enter")
  await expect(editor(page)).toBeFocused()
}

export async function leave(page: Page) {
  await page.keyboard.press("Escape")
  await expect(editor(page)).toHaveCount(0)
}
