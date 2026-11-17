import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { selectTwo, shapeFrame } from "./two-selected.mjs"

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
  const { deck, first, second } = await selectTwo(kit)
  let read = await tool("airdesign_read_deck", { deck, slide: "256" })
  await expect
    .poll(async () => {
      read = await tool("airdesign_read_deck", { deck, slide: "256" })
      return read.index === "ready" && read.elements.some((each) => each.node === second)
    })
    .toBe(true)
  expect(
    await tool("airdesign_edit_deck", { deck, base: read.revision, changes: [{ op: "delete", node: second }] }),
  ).toMatchObject({
    ok: true,
  })
  await expect(shapeFrame(kit.page, second)).toHaveCount(0)
  await expect(kit.page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", first)
}

export default { name: "one-left", design: editor, drive }
