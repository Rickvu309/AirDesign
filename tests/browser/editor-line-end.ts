import type { Page } from "@playwright/test"
import { accent, spot } from "./editor-deck"

export async function gripCentre(page: Page, grip: string) {
  const box = await page.locator(`[data-grip="${grip}"]`).boundingBox()
  if (box === null) throw new Error(`no ${grip}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

export async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
}

export type Point = { readonly x: number; readonly y: number }

export async function paintedStart(page: Page, id: string): Promise<Point> {
  return page.locator(`[data-slide-box] [data-node="${id}"]`).evaluate((element) => {
    const node = element as HTMLElement
    const d = node.querySelector("path")?.getAttribute("d") ?? ""
    const first = /M\s*([-\d.]+)[,\s]+([-\d.]+)/.exec(d)
    if (first === null) throw new Error(`no path in ${d}`)
    return {
      x: parseFloat(node.style.left || "0") + Number(first[1]),
      y: parseFloat(node.style.top || "0") + Number(first[2]),
    }
  })
}

export const lineFrom = (parent: string, start: unknown, end: Point = { x: 80, y: 500 }) => ({
  id: "l:1",
  type: "shape" as const,
  parent,
  props: {
    box: spot(0, 0, 10, 10),
    strokes: accent,
    stroke: { weight: 4, align: "center", dash: "solid" },
    geometry: { kind: "line", start, end, route: "straight", arrows: ["none", "none"] },
  },
})
