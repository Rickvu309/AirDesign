import type { Page } from "@playwright/test"
import type { ResolvedSlide } from "../../packages/document/src/index.ts"
import type { FontWidths } from "../../packages/doom/src/index.ts"
import { fontFamily as cssFamily } from "../../packages/fonts/src/index.ts"
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

export function slideWidths(page: Page, slides: readonly ResolvedSlide[]): Promise<FontWidths> {
  return measureSlideWidths(page, slides, cssFamily)
}
