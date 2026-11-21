import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"

function answerOf(text) {
  const line = text.split("\n").find((each) => each.startsWith("data: "))
  return JSON.parse(line === undefined ? text : line.slice(6)).result
}

const chart = { kind: "bar", categories: ["Jul", "Aug", "Sep"], series: [{ name: "Revenue", values: [12, 16, 20] }] }

const nowhere = JSON.stringify([{ from: 9, runs: [{ from: 0, text: "A paragraph the title does not have" }] }])

async function drive(kit) {
  const { page } = kit
  const { cookie } = await kit.signIn()
  await page.goto("/")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/blank.pptx"))
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
  const read = (await tool("airdesign_read_deck", { deck })).structuredContent
  const first = read.slides[0].id
  const grown = await tool("airdesign_edit_deck", {
    deck,
    base: read.revision,
    changes: [{ op: "add_slide", after: first, layout: first }],
  })
  const added = grown.structuredContent?.slides?.[0]
  if (added === undefined) throw new Error("add_slide")
  await tool("airdesign_edit_deck", {
    deck,
    base: grown.structuredContent.revision,
    changes: [
      {
        op: "add",
        kind: "chart",
        slide: added,
        box: { x: 72, y: 120, w: 520, h: 320 },
        chart: { value: JSON.stringify(chart) },
      },
    ],
  })
  const planted = await page.request.post("/decks/commit", {
    headers: { "content-type": "application/json", cookie },
    data: { deck, batch: [{ node: `${first}.2`, value: nowhere }] },
  })
  if (!planted.ok()) throw new Error(`commit ${String(planted.status())}`)
  await page.reload()
  await page
    .locator(".thin-page[data-deck-ready]")
    .waitFor({ timeout: 15000 })
    .catch(() => undefined)
  await page
    .locator("[data-sonner-toast]")
    .waitFor({ timeout: 5000 })
    .catch(() => undefined)
}

export default { name: "unwritable-edit-open", design: null, drive }
