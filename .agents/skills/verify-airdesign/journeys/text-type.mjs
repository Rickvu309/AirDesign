import path from "node:path"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"
import { unfold } from "../look/unfold.mjs"

export default async function drive({ repo, origin, page, signIn, post, capture, note, deckRoutes }) {
  const { textCopy } = createRequire(import.meta.url)(path.join(repo, "apps/web/src/copy/text-copy.ts"))
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
  const fixture = path.join(repo, "scripts/pptx-fixtures/nasa-1d-cnn.pptx")
  const opened = await pptx.readParts(await readFile(fixture))
  const fileSlides = pptx.readSlides(opened)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await capture("imported")

  const set = { op: "set", target: "*.title", text: { font: "Georgia" } }
  let edited
  await expect
    .poll(
      async () => {
        const read = await tool("airdesign_read_deck", { deck })
        edited = await call("airdesign_edit_deck", { deck, base: read.revision, changes: [set] })
        return edited.isError === true ? JSON.stringify(edited.structuredContent) : "landed"
      },
      { timeout: 60_000, intervals: [1_000] },
    )
    .toBe("landed")
  note(`airdesign_edit_deck ${JSON.stringify(set)}: ${JSON.stringify(edited.structuredContent)}`)
  await tool("airdesign_stop_run", { deck, runId: edited.structuredContent.runId })
  const read = await tool("airdesign_read_deck", { deck })
  const titles = read.elements.filter((element) => element.role === "title")
  const worded = (value) => (value.startsWith("[") ? /"text":"[^"]/.test(value) : value.trim() !== "")
  const typed = titles.filter((element) => worded(element.value ?? ""))
  expect(titles.length).toBeGreaterThan(5)
  for (const title of typed) expect(title.design).toContain("text.font Georgia")
  note(
    `set landed on ${edited.structuredContent.elements.length} titles; read_deck prints the first as: ${titles[0].design}`,
  )

  const title = typed[0]
  const position = read.slides.find((slide) => slide.id === title.slide).position
  const part = fileSlides.find((slide) => slide.slide === title.slide).part
  const shape = title.node.split(".")[1]
  const entry = (number) => page.locator(`[data-slide-entry="${number}"]`)
  await entry(position + 1).click()
  await expect(entry(position + 1)).toHaveAttribute("aria-current", "true")
  const titleShape = page.locator(`[data-slide-paint] [data-canvas-element="${part}#${shape}"]`)
  const looked = () =>
    titleShape.evaluate((node) => {
      const run = [...node.querySelectorAll("span")].find((span) => span.textContent.trim() !== "")
      const frame = node.getBoundingClientRect()
      const box = run?.getBoundingClientRect()
      return {
        font: run === undefined ? "" : getComputedStyle(run).fontFamily,
        top: Math.round((box?.top ?? 0) - frame.top),
        left: Math.round((box?.left ?? 0) - frame.left),
      }
    })
  await expect.poll(async () => (await looked()).font).toMatch(/^"?Georgia"?,/)
  const agentLook = await looked()
  await capture("agent-georgia-titles")
  note(`The open editor painted slide ${position + 1}'s title in ${agentLook.font} before any reload`)

  await page.getByRole("button", { name: "Design", exact: true }).click()
  await titleShape.click({ position: { x: 4, y: 4 } })
  const panel = page.locator("[data-design-element]")
  const section = (name) => panel.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) })
  const text = panel
  await expect(text.getByRole("textbox", { name: "Font", exact: true })).toHaveValue("Georgia")
  const fill = async (field, value) => {
    await field.fill(value)
    await field.press("Enter")
    await expect(field).toHaveValue(value)
  }
  await fill(text.getByRole("textbox", { name: textCopy.lineHeight, exact: true }), "120")
  await unfold(panel, textCopy.paragraphSpacing)
  await fill(text.getByRole("textbox", { name: "Space before", exact: true }), "6")
  await unfold(panel, "Text box")
  const box = section("Text box")
  await box
    .getByRole("group", { name: "Vertical alignment", exact: true })
    .getByRole("button", { name: "Bottom" })
    .click()
  await fill(
    box.getByRole("group", { name: "Margins", exact: true }).getByRole("textbox", { name: "Left", exact: true }),
    "36",
  )
  await expect.poll(async () => (await looked()).left).toBeGreaterThan(agentLook.left)
  await expect(page.getByRole("button", { name: "Undo text box", exact: true })).toBeVisible()
  await box.scrollIntoViewIfNeeded()
  await capture("person-laid-out-title")
  note(
    `A person's spacing, Bottom and a 36 pt left margin moved the title text from ${JSON.stringify(agentLook)} to ${JSON.stringify(await looked())}`,
  )

  const server = async () => JSON.stringify((await post(deckRoutes.open, { deck }, cookie)).json.register)
  await expect.poll(server).toContain('"anchor":{"set":"b"}')
  note("The server holds the agent's font rows and the person's body rows")

  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "text-type.pptx")
  await (await downloading).saveAs(exported)
  const parts = await pptx.readParts(await readFile(exported))
  const body = pptx.shownBody(parts, { slide: title.slide, part, shape })
  expect(body.anchor).toEqual({ value: "b", own: true })
  expect(body.insets.value.left).toBe(457200)
  const georgia = typed.filter((each) => {
    const xml = new TextDecoder().decode(parts.get(fileSlides.find((slide) => slide.slide === each.slide).part))
    return xml.includes('<a:latin typeface="Georgia"/>')
  })
  expect(georgia.length).toBe(typed.length)
  note(
    `The export keeps the person's body on the title and Georgia on ${georgia.length} of ${typed.length} titled slides`,
  )

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(exported)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", page.url().split("/").at(-1))
  await entry(position + 1).click()
  await expect.poll(async () => (await looked()).font).toMatch(/^"?Georgia"?,/)
  await capture("reopened")
  note("The exported file opened again with the title in Georgia and its new layout")
}
