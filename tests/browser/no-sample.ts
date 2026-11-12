import { expect, type Page } from "@playwright/test"
import { airaCopy } from "../../apps/web/src/copy/aira-copy.ts"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import { creditsCopy } from "../../apps/web/src/credits/credits-sample.ts"

const sampleWords = [
  "Q3 investor update",
  "64%",
  "38%",
  "Weekly usage",
  "Resets Mon 8:00 AM",
  "See all",
  "Make an 8-slide investor update from my notes. Calm, data first, our Halden brand.",
  "Q3 board notes.docx",
  "Read 1 file, built 8 slides",
  "Your deck is ready. Eight slides, every number from your notes.",
  "Undo",
  "Slide 3",
  "Ask Aira",
]
const sampleControls = ["Attach", "Microphone"]

export async function expectNoSample(page: Page) {
  const body = (await page.locator("body").textContent()) ?? ""
  for (const word of sampleWords) expect(body, word).not.toContain(word)
  for (const name of sampleControls) {
    await expect(page.getByRole("button", { name, exact: true }), name).toHaveCount(0)
  }
  await expect(page.locator("circle[stroke-dasharray]"), "usage ring").toHaveCount(0)
  await expect(page.locator("div.h-12.bg-line"), "notes band").toHaveCount(0)
  const seen = (await page.locator(".screen-frame").innerText())
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  expect(new Set(seen)).toEqual(
    new Set([
      "clean",
      "1",
      "Hello",
      "63%",
      "Export",
      "New slide",
      creditsCopy.newChat,
      productCopy.agentName,
      airaCopy.welcome,
      ...airaCopy.starters,
      airaCopy.caution,
      "Agent",
      "Design",
    ]),
  )
}
