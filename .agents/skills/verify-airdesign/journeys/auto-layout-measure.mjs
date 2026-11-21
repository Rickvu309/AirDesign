import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { groupCopy } from "../../../../apps/web/src/copy/arrange-copy.ts"

const part = "ppt/slides/slide1.xml"
const line = '<a:p><a:r><a:rPr lang="en-US" sz="1800"/><a:t>A card line</a:t></a:r></a:p>'
const card = (id, y) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Card ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1828800" y="${y}"/><a:ext cx="3657600" cy="369332"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="DDEEFF"/></a:solidFill></p:spPr><p:txBody><a:bodyPr wrap="square"><a:spAutoFit/></a:bodyPr><a:lstStyle/>${line}</p:txBody></p:sp>`
const longer =
  "A card line that an agent wrote much longer, so that it wraps onto several lines inside the card and pushes the next card down the column"

export default async function drive({ page, origin, signIn, post, capture, note, deckRoutes, repo, expect }) {
  const { mcpRoutes } = await import(pathToFileURL(path.join(repo, "packages/catalog/dist/index.js")).href)
  const zip = createRequire(path.join(repo, "packages/pptx/package.json"))("@zip.js/zip.js")
  const reader = new zip.ZipReader(
    new zip.Uint8ArrayReader(new Uint8Array(await readFile(path.join(repo, "scripts/pptx-fixtures/blank.pptx")))),
  )
  const writer = new zip.ZipWriter(new zip.Uint8ArrayWriter())
  for (const entry of await reader.getEntries()) {
    if (entry.directory) continue
    let bytes = await entry.getData(new zip.Uint8ArrayWriter())
    if (entry.filename === part)
      bytes = new TextEncoder().encode(
        Buffer.from(bytes)
          .toString("utf8")
          .replace("</p:spTree>", `${card(20, 2743200)}${card(21, 3657600)}</p:spTree>`),
      )
    await writer.add(entry.filename, new zip.Uint8ArrayReader(bytes))
  }
  await reader.close()
  const buffer = Buffer.from(await writer.close())
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
          .find((each) => each.startsWith("data: "))
          .slice(6)
      : text
    return JSON.parse(body).result
  }
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles({
    name: "cards.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer,
  })
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const shape = (shown) => page.locator(`[data-slide-paint] [data-canvas-element="${part}#${shown}"]`)
  await shape(20).click()
  await shape(21).click({ modifiers: ["Shift"] })
  await page.keyboard.press("Shift+A")
  await expect(page.locator("[data-slide-paint]").getByRole("status")).toHaveText(groupCopy.said.frame)
  const paintedBefore = await shape(21).boundingBox()
  await capture("column-wrapped")
  const cards = (read) => {
    const found = (suffix) => read.elements.find((element) => element.node.endsWith(suffix))
    return { top: found(".20"), next: found(".21") }
  }
  let before
  await expect
    .poll(
      async () => {
        const read = (await tool("airdesign_read_deck", { deck })).structuredContent
        before = read
        return read.elements.some((element) => element.frame === "auto") ? "framed" : "waiting"
      },
      { timeout: 30_000, intervals: [500] },
    )
    .toBe("framed")
  const { top, next } = cards(before)
  const edited = await tool("airdesign_edit_deck", {
    deck,
    base: before.revision,
    changes: [
      { node: top.node, readAt: top.version, value: JSON.stringify([{ from: 0, runs: [{ from: -1, text: longer }] }]) },
    ],
  })
  note(`airdesign_edit_deck answered ${JSON.stringify(edited.structuredContent).slice(0, 300)}`)
  expect(edited.isError).not.toBe(true)
  const after = cards((await tool("airdesign_read_deck", { deck })).structuredContent)
  const grew = after.top.box.h - top.box.h
  expect(grew).toBeGreaterThan(23)
  expect(after.next.box.y - next.box.y).toBeCloseTo(grew, 0)
  await expect.poll(async () => (await shape(21).boundingBox()).y - paintedBefore.y).toBeGreaterThan(20)
  await capture("agent-text-grew")
  const paintedAfter = await shape(21).boundingBox()
  const width = (await page.locator("[data-slide-paint]").boundingBox()).width
  const slideWidth = 12_192_000
  const painted = ((paintedAfter.y - paintedBefore.y) * slideWidth) / width / 12_700
  expect(Math.abs(painted - grew)).toBeLessThan(slideWidth / width / 12_700 + 0.2)
  note(
    `Two growing text boxes wrapped into an auto layout column with Shift+A. An agent set the top card's text to a long line over MCP, and its very next read_deck answered the top card ${top.box.h} -> ${after.top.box.h} pt tall and the next card moved down by the same ${grew} pt; the open editor painted the next card ${Math.round(paintedAfter.y - paintedBefore.y)} px lower, which is ${Math.round(painted * 10) / 10} pt at this zoom.`,
  )
  await page.reload()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await expect.poll(async () => (await shape(21).boundingBox()).y).toBeCloseTo(paintedAfter.y, 0)
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "auto-layout-measure.pptx")
  await (await downloading).saveAs(exported)
  const saved = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(exported))))
  const slide = (await saved.getEntries()).find((entry) => entry.filename === part)
  const xml = Buffer.from(await slide.getData(new zip.Uint8ArrayWriter())).toString("utf8")
  await saved.close()
  const placed = (shown) =>
    new RegExp(`<p:cNvPr id="${shown}"[^]*?<a:off x="(\\d+)" y="(\\d+)"/><a:ext cx="(\\d+)" cy="(\\d+)"/>`).exec(xml)
  expect(Number(placed(20)?.[4]) / 12_700).toBeCloseTo(after.top.box.h, 0)
  expect(Number(placed(21)?.[2]) / 12_700).toBeCloseTo(after.next.box.y, 0)
  note(
    `The export ${path.basename(exported)} writes the top card ${placed(20)?.[4]} EMU tall and the next card at y ${placed(21)?.[2]}, as the agent read them.`,
  )
  const undone = await post(deckRoutes.undo, { deck, runId: edited.structuredContent.runId }, cookie)
  expect(undone.json.ok).toBe(true)
  await expect.poll(async () => Math.abs((await shape(21).boundingBox()).y - paintedBefore.y)).toBeLessThan(2)
  await capture("agent-text-undone")
  note(`Undo of the agent's run took the long line back, and the editor laid the next card back where it began.`)
}
