import path from "node:path"
import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"

export default async function drive({ repo, origin, page, signIn, post, capture, note, deckRoutes, airaRoutes, aira }) {
  const { mcpRoutes } = await import(pathToFileURL(path.join(repo, "packages/catalog/dist/index.js")).href)
  const { cookie } = await signIn()
  let id = 0
  async function tool(name, args) {
    const response = await fetch(new URL(mcpRoutes.mcp.path, origin), {
      method: "POST",
      headers: { cookie, "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } }),
    })
    expect(response.status).toBe(200)
    const text = await response.text()
    const body = text.startsWith("event:")
      ? text
          .split("\n")
          .find((line) => line.startsWith("data: "))
          .slice(6)
      : text
    const answer = JSON.parse(body).result
    expect(answer.isError).not.toBe(true)
    note(`${name}: ${JSON.stringify(answer.structuredContent)}`)
    return answer.structuredContent
  }
  await page.goto("/")
  await capture("home")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  await capture("untouched")
  aira([{ name: "index-read.sse", fill: { deck } }, { name: "index-answer.sse" }])
  const asked = [{ role: "user", content: "Read the untouched first slide." }]
  const turn = await post(airaRoutes.turn, { deck, messages: asked }, cookie)
  expect(turn.status).toBe(200)
  const call = turn.json.lines.find((line) => line.type === "tool")
  const end = turn.json.lines.at(-1)
  expect(call).toMatchObject({ name: "airdesign_read_deck", input: { deck } })
  expect(end).toMatchObject({ type: "end", ok: true, stop: "tool_use" })
  const first = await tool(call.name, call.input)
  expect(first).toMatchObject({ ok: true, revision: 0, index: "ready", slides: [{ id: "256", position: 0 }] })
  expect(first.elements).toEqual([
    {
      node: "256.2",
      slide: "256",
      kind: "shape",
      grouped: false,
      value: '[{"from":0,"runs":[{"from":0,"text":"Hello"}]}]',
      version: 0,
      box: { x: 457200, y: 457200, cx: 5486400, cy: 1828800 },
    },
  ])
  const continued = await post(
    airaRoutes.turn,
    {
      deck,
      messages: [
        ...asked,
        { role: "assistant", content: end.content },
        { role: "user", content: [{ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(first) }] },
      ],
    },
    cookie,
  )
  const finished = continued.json.lines.at(-1)
  expect(finished).toMatchObject({ type: "end", ok: true, stop: "end_turn" })
  expect(finished.usage.used).toBeGreaterThan(end.usage.used)
  note(
    "Aira's recorded read tool received the untouched version-zero answer; its next metered call accepted that full tool result",
  )
  const untouched = await post(deckRoutes.open, { deck }, cookie)
  expect(untouched.json.register.nodes).not.toContain("256.2")
  const value = JSON.stringify([{ from: 0, runs: [{ from: 0, text: "Read before editing" }] }])
  const edited = await tool("airdesign_edit_deck", {
    deck,
    base: first.revision,
    changes: [{ node: first.elements[0].node, readAt: 0, value }],
  })
  await tool("airdesign_stop_run", { deck, runId: edited.runId })
  const after = await tool("airdesign_read_deck", { deck, slide: "256" })
  expect(after.elements).toMatchObject([{ node: "256.2", value, version: 1, box: first.elements[0].box }])
  await expect.poll(async () => (await post(deckRoutes.original, { deck }, cookie)).json.ok).toBe(true)
  const url = page.url()
  await page.goto("/version")
  await page.evaluate(async () => {
    localStorage.clear()
    sessionStorage.clear()
    for (const database of await indexedDB.databases()) {
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(database.name)
        request.onsuccess = resolve
        request.onerror = () => reject(request.error)
        request.onblocked = () => reject(new Error("database open"))
      })
    }
    const directory = await navigator.storage.getDirectory()
    for await (const name of directory.keys()) await directory.removeEntry(name, { recursive: true })
  })
  await page.goto(url)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Read before editing")
  await capture("cleared-browser")
  const reopened = await tool("airdesign_read_deck", { deck })
  expect(reopened.elements).toEqual(after.elements)
  expect(reopened.slides).toEqual(first.slides)
  note("untouched version-zero text and box came from the device index; the edit survived clearing all device storage")
}
