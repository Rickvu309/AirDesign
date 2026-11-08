import { validate } from "../../deck/src/apply.ts"
import { chromium } from "playwright"
import type { Deck, Id } from "../../deck/src/model.ts"
export async function snapshot({ deck, slideId, origin, format = "png" }: { deck: Deck; slideId: Id; origin: string; format?: "png" | "pdf" }): Promise<Uint8Array> {
  validate(deck)
  const slide = deck.slides.find(s => s.id === slideId)
  if (!slide) throw new Error("Snapshot slide missing")
  const url = new URL("/render-fixture?snapshot=1", origin)
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") throw new Error("Snapshot requires a local renderer")
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1470, height: 923 }, deviceScaleFactor: 1 })
    await page.goto(url.href)
    await page.locator("[data-ready=true]").waitFor()
    await page.getByLabel("Deck JSON").fill(JSON.stringify({ ...deck, slides: [slide] }))
    await page.getByRole("button", { name: "Load saved deck" }).click()
    await page.waitForFunction(version => document.querySelector("[data-slide]")?.getAttribute("data-version") === String(version) && document.querySelector("[data-ready=true]"), slide.version)
    if (format === "pdf") return await page.pdf({ width: `${slide.size.width}px`, height: `${slide.size.height}px`, printBackground: true })
    return await page.locator("[data-slide]").locator("..").screenshot({ animations: "disabled" })
  } finally { await browser.close() }
}
export function thumbnailCache<T>(limit = 100) {
  const cache = new Map<string, Promise<T>>()
  return (deckId: Id, slide: Deck["slides"][number], render: () => Promise<T>): Promise<T> => {
    const key = `${deckId}:${slide.id}:${slide.version}`
    const cached = cache.get(key)
    if (cached) return cached
    const value = render().catch(error => { cache.delete(key); throw error })
    cache.set(key, value)
    if (cache.size > limit) { const oldest = cache.keys().next().value; if (oldest) cache.delete(oldest) }
    return value
  }
}
