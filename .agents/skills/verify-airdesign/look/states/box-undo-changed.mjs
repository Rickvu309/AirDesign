import { undoCopy } from "../../bin/product-copy.mjs"
import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"
import { placeText } from "../../bin/text-place.mjs"
import { shapeFrame } from "./two-selected.mjs"

const agentText = "Written by an agent"
const drafted = (element) => element.value?.includes('"text":"Draft"')

async function drive(kit) {
  const { cookie } = await kit.signIn()
  async function tool(name, args) {
    const response = await fetch(new URL(kit.mcpRoutes.mcp.path, kit.origin), {
      method: "POST",
      headers: { cookie, "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    })
    const text = await response.text()
    const body = text.startsWith("event:")
      ? text
          .split("\n")
          .find((line) => line.startsWith("data: "))
          .slice(6)
      : text
    return JSON.parse(body).result.structuredContent
  }
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/clean.pptx"))
  const deck = kit.page.url().split("/").at(-1)
  const texts = kit.page.locator('[data-slide-paint] [contenteditable="true"]')
  await placeText(kit.page)
  await expect(texts).toHaveCount(2)
  await kit.page.keyboard.type("Draft")
  await kit.page.keyboard.press("Escape")
  await expect(kit.page.getByRole("button", { name: undoCopy.undoNamed.text })).toBeEnabled()
  let read
  await expect
    .poll(async () => {
      read = await tool("airdesign_read_deck", { deck, slide: "256" })
      return read.index === "ready" && read.elements.some(drafted)
    })
    .toBe(true)
  const added = read.elements.find(drafted)
  const value = JSON.stringify([{ from: 0, runs: [{ from: 0, text: agentText }] }])
  const changes = [{ node: added.node, readAt: added.version, value }]
  expect(await tool("airdesign_edit_deck", { deck, base: read.revision, changes })).toMatchObject({ ok: true })
  const painted = shapeFrame(kit.page, added.node).locator('[contenteditable="true"]')
  await expect(painted).toHaveText(agentText)
  await kit.page.keyboard.press("ControlOrMeta+z")
  await expect(kit.page.getByText(undoCopy.undoChanged, { exact: true })).toBeVisible()
  await expect(painted).toHaveText(agentText)
}

export default { name: "box-undo-changed", design: editor, drive }
