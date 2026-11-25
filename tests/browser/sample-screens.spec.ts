import { expect } from "@playwright/test"
import { nodeId, reservedPartId } from "../../packages/doom/src/index.ts"
import { sampleRoutes } from "../../apps/web/src/samples/sample-routes"
import { test } from "./deck-test"
import { openScreen } from "./open-screen"

for (const [name, path] of Object.entries(sampleRoutes)) {
  test(`${name} paints each line of text inside the width the layout gave it`, async ({ page }) => {
    const faults: string[] = []
    page.on("pageerror", (error) => faults.push(error.message))
    page.on("console", (message) => message.type() === "error" && faults.push(message.text()))
    await openScreen(page, path)
    await page.locator("[data-doom-slide]").waitFor()
    await expect(page.locator("[data-fonts-pending]")).toHaveCount(0)
    const lines = await page.locator("[data-line]").count()
    expect(lines).toBeGreaterThan(0)
    const overflowing = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-line]")]
        .filter((line) => line.scrollWidth > line.clientWidth + 1)
        .map((line) => line.textContent),
    )
    expect(overflowing).toEqual([])
    expect(faults).toEqual([])
  })
}

for (const [name, path] of Object.entries(sampleRoutes)) {
  test(`${name} paints no line of text over another layer's words or fill`, async ({ page }) => {
    await openScreen(page, path)
    await page.locator("[data-doom-slide]").waitFor()
    await expect(page.locator("[data-fonts-pending]")).toHaveCount(0)
    const ids = await page
      .locator("[data-doom-slide] [data-node^=p]")
      .evaluateAll((nodes) => nodes.flatMap((node) => node.getAttribute("data-node") ?? []))
    const parts = [...new Set(ids.filter((id) => reservedPartId(nodeId(id))))]
    const clashes = await page.evaluate((ids) => {
      const parts = new Set(ids)
      const slide = document.querySelector("[data-doom-slide]")!
      const owner = (element: Element) => element.closest("[data-node]")!
      const drawn = (element: Element) => !parts.has(owner(element).getAttribute("data-node") ?? "")
      const lines = [...slide.querySelectorAll<HTMLElement>("[data-line]")].filter(
        (line) => drawn(line) && line.textContent?.trim(),
      )
      const bodies = [...slide.querySelectorAll<HTMLElement>("[data-body]")].filter(drawn)
      const meets = (a: DOMRect, b: DOMRect) =>
        Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
        Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
      const inked = (line: HTMLElement) => line.getBoundingClientRect()
      const found: string[] = []
      for (const line of lines) {
        const node = owner(line)
        for (const other of lines)
          if (owner(other) !== node && line !== other && meets(inked(line), inked(other)))
            found.push(`${line.textContent} / ${other.textContent}`)
        for (const body of bodies) {
          const host = owner(body)
          if (host.contains(node) || node.contains(host)) continue
          if (meets(inked(line), body.getBoundingClientRect()))
            found.push(`${line.textContent} / ${host.getAttribute("data-node")}`)
        }
      }
      return found
    }, parts)
    expect(clashes).toEqual([])
  })
}
