import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"

const address = "https://images.verify.test/web-logo.png"

function answerOf(text) {
  const line = text.split("\n").find((each) => each.startsWith("data: "))
  return JSON.parse(line === undefined ? text : line.slice(6)).result
}

async function drive(kit) {
  const { page } = kit
  const { cookie } = await kit.signIn()
  await page.goto("/")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/picture-png.pptx"))
  const deck = page.url().replace(/^.*\//, "")
  let id = 0
  const tool = async (name, args) => {
    id += 1
    const answer = await page.request.post("/mcp", {
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", cookie },
      data: { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } },
    })
    return answerOf(await answer.text())
  }
  await expect.poll(async () => (await tool("airdesign_read_deck", { deck })).structuredContent?.index).toBe("ready")
  const before = await page
    .locator('[data-slide-paint] [data-canvas-element$="#4"]')
    .evaluate((frame) => getComputedStyle(frame).backgroundImage)
  const read = (await tool("airdesign_read_deck", { deck })).structuredContent
  const picture = `${read.slides[0].id}.4`
  const set = await tool("airdesign_edit_deck", {
    deck,
    base: read.revision,
    changes: [{ op: "set", target: picture, fills: { source: address, mode: "fit" } }],
  })
  if (set.isError === true) return
  const painted = page.locator('[data-slide-paint] [data-canvas-element$="#4"]')
  await expect.poll(() => painted.evaluate((frame) => getComputedStyle(frame).backgroundImage)).not.toBe(before)
}

export default { name: "web-image-set", design: null, drive }
