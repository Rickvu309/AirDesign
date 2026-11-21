import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"

function answerOf(text) {
  const line = text.split("\n").find((each) => each.startsWith("data: "))
  return JSON.parse(line === undefined ? text : line.slice(6)).result
}

const rows = [
  ["Milestone", "Owner", "Due"],
  ["Sign the cloud commitment", "CFO", "30 Nov"],
  ["Re-price usage tiers", "CRO", "31 Jan"],
].map((cells, from) => ({ from, cells: cells.map((text) => [{ from: 0, runs: [{ from: 0, text }] }]) }))

const title = [{ from: 0, runs: [{ from: -1, text: "Q3 review\nRevenue ran ahead of plan" }] }]

const chart = {
  kind: "bar",
  categories: ["Jul", "Aug", "Sep"],
  series: [
    { name: "Plan", values: [10, 14, 18] },
    { name: "Actual", values: [12, 16, 20] },
  ],
}

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
  const first = (await tool("airdesign_read_deck", { deck })).structuredContent
  const slide = first.slides[0].id
  const grown = await tool("airdesign_edit_deck", {
    deck,
    base: first.revision,
    changes: [{ op: "add_slide", after: slide, layout: slide }],
  })
  const added = grown.structuredContent?.slides?.[0]
  if (added === undefined) return
  const filled = await tool("airdesign_edit_deck", {
    deck,
    base: grown.structuredContent.revision,
    changes: [
      { op: "delete", node: `${added}.3` },
      { op: "set", target: `${added}.title`, text: { value: JSON.stringify(title) } },
      {
        op: "add",
        kind: "chart",
        slide: added,
        box: { x: 72, y: 270, w: 400, h: 250 },
        chart: { value: JSON.stringify(chart) },
      },
      {
        op: "add",
        kind: "table",
        slide: added,
        box: { x: 496, y: 270, w: 392, h: 96 },
        table: { value: JSON.stringify({ rows }) },
      },
    ],
  })
  if (filled.isError === true) throw new Error(JSON.stringify(filled.content))
  await page
    .locator('[data-slide-entry="2"]')
    .click({ timeout: 5000 })
    .catch(() => undefined)
  await page.waitForTimeout(1500)
}

export default { name: "added-slide-filled", design: null, drive }
