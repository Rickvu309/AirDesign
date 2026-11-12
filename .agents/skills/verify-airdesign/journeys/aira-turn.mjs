import path from "node:path"
import { expect } from "@playwright/test"

const node = "256.2"
const accept = "application/json, text/event-stream"
const asked = [{ role: "user", content: "Change the title to Hello from Aira" }]

function textOf(value) {
  return JSON.parse(value)
    .map((paragraph) => paragraph.runs.map((run) => run.text).join(""))
    .join("\n")
}

function lastText(register) {
  const rows = register?.elements?.[node]?.landed ?? []
  const last = rows.filter((row) => row.visible && row.property !== "box").at(-1)
  return last === undefined ? null : textOf(last.value)
}

async function forgetLocalRows(page) {
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction("rows", "readwrite")
          transaction.onerror = () => reject(transaction.error)
          transaction.oncomplete = () => {
            database.close()
            resolve()
          }
          const cursor = transaction.objectStore("rows").openCursor()
          cursor.onsuccess = () => {
            const at = cursor.result
            if (at === null) return
            const row = at.value
            if (typeof row === "object" && row !== null && "kind" in row) at.delete()
            at.continue()
          }
        }
      }),
  )
}

async function reopen(page) {
  const deckUrl = page.url()
  await page.goto("/version")
  await forgetLocalRows(page)
  await page.goto(deckUrl)
}

export default async function drive(kit) {
  const { repo, page, signIn, post, capture, note, deckRoutes, airaRoutes, mcpRoutes, aira } = kit
  const { cookie, email } = await signIn()
  note(`signed in as ${email} through the emailed code`)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await capture("imported")
  const base = (await post(deckRoutes.open, { deck }, cookie)).json.revision
  note(`imported clean.pptx as deck ${deck} at revision ${String(base)}`)

  aira([{ name: "edit.sse", fill: { deck, base: String(base), node } }, { name: "edited.sse" }])
  const first = await post(airaRoutes.turn, { deck, messages: asked }, cookie)
  expect(first.status).toBe(200)
  const lines = first.json.lines
  const said = lines.flatMap((line) => (line.type === "text" ? [line.text] : [])).join("")
  const tool = lines.find((line) => line.type === "tool")
  const end = lines.at(-1)
  expect(said).toBe("I will change the title on the first slide.")
  expect(tool).toMatchObject({ name: "airdesign_edit_deck", input: { deck, base } })
  expect(end).toMatchObject({ type: "end", ok: true, stop: "tool_use", usage: { allowed: 2 } })
  expect(end.usage.used).toBeGreaterThan(0)
  note(
    `${airaRoutes.turn.path} streamed ${String(lines.length)} NDJSON lines: the text, one ${tool.name} call, and an end line with stop tool_use and usage ${JSON.stringify(end.usage)}`,
  )

  const params = { name: tool.name, arguments: tool.input }
  const called = await post(mcpRoutes.mcp, { jsonrpc: "2.0", id: 1, method: "tools/call", params }, cookie, { accept })
  const edited = called.json.events[0].result.structuredContent
  expect(edited).toMatchObject({ ok: true, revision: base + 1 })
  expect(typeof edited.runId).toBe("string")
  note(
    `the same call through ${mcpRoutes.mcp.path} with the session cookie landed at revision ${String(edited.revision)} in run ${edited.runId}`,
  )

  const answer = { type: "tool_result", tool_use_id: tool.id, content: JSON.stringify(edited) }
  const messages = [...asked, { role: "assistant", content: end.content }, { role: "user", content: [answer] }]
  const second = await post(airaRoutes.turn, { deck, messages }, cookie)
  const closing = second.json.lines.at(-1)
  expect(closing).toMatchObject({ type: "end", ok: true, stop: "end_turn" })
  expect(closing.usage.used).toBeGreaterThan(end.usage.used)
  note(
    `the next turn sent the tool result back and ended with stop end_turn; usage rose to ${String(closing.usage.used)}`,
  )

  expect(lastText((await post(deckRoutes.open, { deck }, cookie)).json.register)).toBe("Hello from Aira")
  await reopen(page)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello from Aira", { timeout: 20_000 })
  await capture("aira-edited")
  note("the server copy reads Hello from Aira and the reopened deck paints it")

  const undone = await post(deckRoutes.undo, { deck, runId: edited.runId }, cookie)
  expect(undone.json).toMatchObject({ ok: true, deck, revision: edited.revision + 1 })
  expect(lastText((await post(deckRoutes.open, { deck }, cookie)).json.register)).not.toBe("Hello from Aira")
  await reopen(page)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello", { timeout: 20_000 })
  await capture("undone")
  note(
    `${deckRoutes.undo.path} took the run back at revision ${String(undone.json.revision)}; the reopened deck reads Hello`,
  )

  const again = await post(deckRoutes.undo, { deck, runId: edited.runId }, cookie)
  expect(again.json).toEqual({ ok: false, refusal: "run-fenced" })
  note("a second undo of the same run is refused run-fenced")
}
