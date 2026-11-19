import path from "node:path"
import { expect } from "@playwright/test"

export default async function drive({ repo, page, signIn, post, capture, note, deckRoutes, mcpRoutes }) {
  const { cookie } = await signIn()
  let id = 0
  const tool = async (name, args) => {
    const answer = await post(
      mcpRoutes.mcp,
      { jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } },
      cookie,
      { accept: "application/json, text/event-stream" },
    )
    const body = answer.json.events?.[0] ?? answer.json
    expect(body.result.isError).not.toBe(true)
    return body.result.structuredContent
  }
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  const text = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect(text).toHaveText("Hello")
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled()
  await text.dblclick()
  await page.keyboard.press("ControlOrMeta+a")
  await text.pressSequentially("Mine", { delay: 40 })
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: "Undo text edit" })).toBeEnabled()
  const frame = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
  const left = async () => Math.round((await frame.boundingBox()).x)
  const start = await left()
  await page.keyboard.press("Shift+ArrowRight")
  await expect.poll(left).toBeGreaterThan(start)
  const moved = await left()
  await expect(page.getByRole("button", { name: "Undo move" })).toBeEnabled()
  await capture("edited-and-moved")
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(left).toBe(start)
  await expect(page.getByRole("button", { name: "Redo move" })).toBeEnabled()
  await expect(page.getByRole("button", { name: "Undo text edit" })).toBeEnabled()
  await page.getByRole("button", { name: "Redo move" }).click()
  await expect.poll(left).toBe(moved)
  await expect(page.getByRole("button", { name: "Undo move" })).toBeEnabled()
  await capture("undone-and-redone")
  note("Ctrl/Cmd+Z undid the nudge and the Redo move button put it back, painted at once; the buttons named each step")
  const texts = async () => JSON.stringify((await post(deckRoutes.open, { deck }, cookie)).json.register.elements ?? {})
  await expect.poll(texts).toContain("Mine")
  const base = (await post(deckRoutes.open, { deck }, cookie)).json.revision
  const read = await tool("airdesign_read_deck", { deck, slide: "256" })
  const readAt = read.elements.find((element) => element.node === "256.2").version
  await tool("airdesign_edit_deck", {
    deck,
    base,
    changes: [{ node: "256.2", readAt, value: '[{"from":0,"runs":[{"from":0,"text":"Agent"}]}]' }],
  })
  await expect(text).toHaveText("Agent")
  await page.getByRole("button", { name: "Undo move" }).click()
  await expect.poll(left).toBe(start)
  await page.getByRole("button", { name: "Undo text edit" }).click()
  await expect(page.getByText("Unable to undo. This changed after your edit, so it stays as it is.")).toBeVisible()
  await expect(text).toHaveText("Agent")
  await capture("unable-to-undo")
  note(
    "after an agent changed the text over MCP, Undo move still undid the box; Undo text edit left the agent's text and showed the Unable to undo toast",
  )
}
