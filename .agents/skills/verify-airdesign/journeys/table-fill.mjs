import path from "node:path"
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"

export default async function drive({ repo, origin, page, signIn, post, capture, note, deckRoutes }) {
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const { mcpRoutes } = await import(pathToFileURL(path.join(repo, "packages/catalog/dist/index.js")).href)
  const { cookie } = await signIn()
  let id = 0
  async function call(name, args) {
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
    return JSON.parse(body).result
  }
  async function tool(name, args) {
    const answer = await call(name, args)
    expect(answer.isError).not.toBe(true)
    note(`${name}: ${JSON.stringify(answer.structuredContent).slice(0, 400)}`)
    return answer.structuredContent
  }
  const fixture = path.join(repo, "scripts/pptx-fixtures/table-added.pptx")
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const cell = (spot) => page.locator(`[data-slide-paint] [data-canvas-table] [data-table-cell="${spot}"]`)
  const fillOf = (spot) => cell(spot).evaluate((node) => getComputedStyle(node).backgroundColor)
  const plain = await fillOf("0.0")
  await capture("imported")

  let table
  await expect
    .poll(
      async () => {
        const read = await tool("airdesign_read_deck", { deck })
        table = read.elements.find((element) => element.kind === "table")
        return read.index === "ready" && table?.value?.startsWith('{"rows"') === true
      },
      { timeout: 60_000, intervals: [1_000] },
    )
    .toBe(true)
  const value = JSON.parse(table.value)
  const accent1 = { solid: { scheme: "accent1" } }
  value.rows[0].fills = value.rows[0].cells.map(() => accent1)
  const set = { op: "set", target: table.node, table: { value: JSON.stringify(value) } }
  const base = (await tool("airdesign_read_deck", { deck })).revision
  const edited = await call("airdesign_edit_deck", { deck, base, changes: [set] })
  note(`airdesign_edit_deck set ${table.node} with the header row's fills: ${JSON.stringify(edited.structuredContent)}`)
  expect(edited.isError).not.toBe(true)
  await tool("airdesign_stop_run", { deck, runId: edited.structuredContent.runId })
  await expect.poll(() => fillOf("0.2")).not.toBe(plain)
  const header = await fillOf("0.0")
  await capture("agent-filled-header")
  note(`The open editor painted the header row ${header} (was ${plain}) before any reload`)

  await page.getByRole("button", { name: "Design", exact: true }).click()
  await page.locator('[data-slide-paint] [data-canvas-table] [data-table-text="1.0"]').click()
  await page.keyboard.press("Escape")
  const panel = page.locator("[data-design-element]")
  await panel.getByRole("textbox", { name: "Row 2, column 1" }).focus()
  await panel.getByRole("group", { name: "Apply to", exact: true }).getByRole("button", { name: "Row" }).click()
  await panel.getByRole("group", { name: "Cell fill", exact: true }).getByRole("button", { name: "Color" }).click()
  await panel
    .getByRole("group", { name: "Color", exact: true })
    .first()
    .getByRole("button", { name: "Accent 2" })
    .click()
  await expect
    .poll(async () => {
      const fill = await fillOf("1.1")
      return fill !== plain && fill !== header
    })
    .toBe(true)
  await panel.getByRole("combobox", { name: "Borders", exact: true }).click()
  await page.getByRole("option", { name: "Bottom", exact: true }).click()
  await panel.getByRole("group", { name: "Border color", exact: true }).getByRole("button", { name: "Color" }).click()
  await expect(page.getByRole("button", { name: "Undo border", exact: true })).toBeVisible()
  await capture("person-filled-row")
  note(
    `A person filled row 2 ${await fillOf("1.1")} and gave it a bottom border from the panel; Undo reads Undo border`,
  )

  const server = async () => JSON.stringify((await post(deckRoutes.open, { deck }, cookie)).json.register)
  await expect.poll(server).toContain('\\"borders\\":[{\\"bottom\\"')
  note("The server holds the agent's header fills and the person's row fill and border in the table value")

  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "table-fill.pptx")
  await (await downloading).saveAs(exported)
  const parts = await pptx.readParts(await readFile(exported))
  const shape = table.node.split(".")[1]
  const cells = pptx.readCells(parts, "ppt/slides/slide1.xml", shape)
  expect(cells[0].map((each) => each.fill)).toEqual([accent1, accent1, accent1])
  expect(cells[1].map((each) => each.fill?.solid?.scheme)).toEqual(["accent2", "accent2", "accent2"])
  expect(cells[1].map((each) => each.borders.bottom?.fill)).toEqual([accent1, accent1, accent1])
  note(`The export holds the header's accent1 fills, row 2's accent2 fills and its accent1 bottom border`)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(exported)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", page.url().split("/").at(-1))
  await expect.poll(() => fillOf("0.1")).toBe(header)
  await capture("reopened")
  note("The exported file opened again with both rows painted as before")
}
