import type { Page } from "@playwright/test"
import type { FontWidths, ResolvedSlide } from "../../packages/document/src/index.ts"
import { fontFamily as cssFamily } from "../../packages/fonts/src/index.ts"
import { decksOn } from "./deck-test"
import { slideWidths as measureSlideWidths } from "./measure-fonts.ts"

export { cssFamily }
export { measureFaces } from "./measure-fonts.ts"

export async function paintedFamilies(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const found = new Set<string>()
    for (const node of document.querySelectorAll<HTMLElement>("[data-slide-paint] [data-paragraph]")) {
      found.add(getComputedStyle(node).fontFamily)
      found.add(getComputedStyle(node, "::before").fontFamily)
      for (const span of node.querySelectorAll("span")) found.add(getComputedStyle(span).fontFamily)
    }
    return [...found]
  })
}

export async function paintedHeights(
  page: Page,
  boxes: readonly { readonly key: string; readonly width: number }[],
): Promise<readonly (number | null)[]> {
  await decksOn(page).ready()
  return page.evaluate(
    (boxes) =>
      boxes.map(({ key, width }) => {
        const frame = document.querySelector<HTMLElement>(
          `[data-slide-paint] [data-canvas-element="${CSS.escape(key)}"]`,
        )
        if (frame === null) return null
        const scale = frame.getBoundingClientRect().width / width
        let height = 0
        for (const block of frame.querySelectorAll<HTMLElement>("[data-paragraph]")) {
          const style = getComputedStyle(block)
          height +=
            block.getBoundingClientRect().height +
            Number.parseFloat(style.marginTop) +
            Number.parseFloat(style.marginBottom)
        }
        return height / scale
      }),
    [...boxes],
  )
}

export function slideWidths(page: Page, slides: readonly ResolvedSlide[]): Promise<FontWidths> {
  return measureSlideWidths(page, slides, cssFamily)
}
