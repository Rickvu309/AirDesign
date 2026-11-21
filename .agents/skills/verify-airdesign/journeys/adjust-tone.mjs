import path from "node:path"
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"
import { selectTwoTextBoxes } from "../look/tone-selection.mjs"
import { adjustToneCopy as words, airaCopy, productCopy, toolbarCopy, undoCopy } from "../bin/product-copy.mjs"

const node = "256.2"
const original = "Hello"
const first = "Greetings"
const second = "Good day"
const done = "Adjusted the tone of the text."
const accept = "application/json, text/event-stream"

function readText(value) {
  return JSON.parse(value)
    .map(({ runs }) => runs.map(({ text }) => text).join(""))
    .join("\n")
}

export default async function drive(kit) {
  const { repo, page, context, signIn, post, capture, note, deckRoutes, mcpRoutes, airaRoutes, aira, failReply } = kit
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const { cookie } = await signIn()
  const fixture = path.join(repo, "scripts/pptx-fixtures/clean.pptx")
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect(editor).toHaveText(original)
  const deck = page.url().split("/").at(-1)
  const design = page.getByRole("button", { name: "Design", exact: true })
  const trigger = page.getByRole("button", { name: words.title, exact: true })
  const tone = page.getByRole("dialog", { name: words.title })
  const preset = tone.getByRole("button", { name: words.presets[0] })
  const reset = tone.getByRole("button", { name: words.reset, exact: true })
  const retry = tone.getByRole("button", { name: words.retry, exact: true })
  const log = page.locator("[data-editor-panel]").getByRole("log")
  const read = async () => {
    const response = await post(
      mcpRoutes.mcp,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "airdesign_read_deck", arguments: { deck, slide: "256" } },
      },
      cookie,
      { accept },
    )
    return response.json.events[0].result.structuredContent
  }
  const register = async () => (await post(deckRoutes.open, { deck }, cookie)).json.register
  const readElement = async () => (await read()).elements.find((element) => element.node === node)
  await expect.poll(async () => (await read()).index).toBe("ready")
  const opened = await read()
  const change = (element, text) => ({
    node: element.node,
    readAt: element.version,
    value: JSON.stringify([{ from: 0, runs: [{ from: 0, text }] }]),
  })
  const script = (base, ...changes) => [
    {
      name: "adjust-tone.sse",
      fill: { input: JSON.stringify(JSON.stringify({ deck, base, changes })).slice(1, -1) },
    },
    { name: "tone-done.sse" },
  ]
  const requests = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === airaRoutes.turn.path) requests.push(request.postDataJSON())
  })

  await design.click()
  await capture("slide")
  await trigger.click()
  await expect(preset).toBeEnabled()
  await capture("dial")
  await page.keyboard.press("Escape")
  await editor.click()
  await expect(page.locator("[data-design-element]")).toHaveAttribute("data-design-element", node)
  await expect(trigger).toHaveCount(0)
  await capture("text")
  note("One text layer shows no Adjust tone in its title line, as Figma's text panel shows none.")
  await page.locator("[data-slide-paint]").click({ position: { x: 8, y: 8 } })
  await expect(page.locator("[data-design-element]")).toHaveCount(0)
  await trigger.click()
  aira(script(opened.revision, change({ node, version: 0 }, first)))
  await preset.click()
  await expect(log.getByText(done, { exact: true })).toBeVisible()
  await expect(log.getByRole("button", { name: undoCopy.undo, exact: true })).toBeEnabled()
  await expect(editor).toHaveText(first)
  expect(requests[0].messages.at(-1).content).toContain(`slide 256. Tone: ${words.presets[0]}`)
  expect(requests[0].messages.at(-1).content).toContain("all editable text elements on slide 256")
  expect(readText((await readElement()).value)).toBe(first)
  const initialRows = (await register()).elements[node].landed
  expect(initialRows.filter((row) => row.visible)).toHaveLength(1)
  await capture("aira-rewrite")
  note("The slide's text rewrite appeared in the Agent panel, passed through MCP and painted on the open slide.")

  await design.click()
  await trigger.click()
  await expect(retry).toBeEnabled()
  const beforeRetry = await read()
  aira(
    script(
      beforeRetry.revision + 1,
      change({ node, version: beforeRetry.elements.find((element) => element.node === node).version + 1 }, second),
    ),
  )
  await retry.click()
  await expect(editor).toHaveText(second)
  await expect(log.getByRole("button", { name: undoCopy.undo, exact: true })).toBeEnabled()
  await expect(log.getByText(airaCopy.undone)).toHaveCount(1)
  expect(readText((await readElement()).value)).toBe(second)
  await page.reload()
  await expect(editor).toHaveText(second)
  await expect(log.getByRole("button", { name: undoCopy.undo, exact: true })).toBeEnabled()
  await capture("reloaded")

  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export", exact: true }).click()
  const file = path.join(path.dirname(await capture("exported")), "adjust-tone.pptx")
  await (await downloading).saveAs(file)
  const parts = await pptx.readParts(await readFile(file))
  const originalParts = await pptx.readParts(await readFile(fixture))
  const differences = [...new Set([...parts.keys(), ...originalParts.keys()])].filter((name) => {
    const before = originalParts.get(name)
    const after = parts.get(name)
    return before === undefined || after === undefined || !Buffer.from(before).equals(Buffer.from(after))
  })
  expect(differences).toEqual(["ppt/slides/slide1.xml"])
  expect(new TextDecoder().decode(parts.get(differences[0]))).toContain(second)
  note(
    "The retried text survived reload and exported as native PowerPoint text. Every other package part was byte-identical.",
  )

  await design.click()
  await trigger.click()
  await expect(reset).toBeEnabled()
  await reset.click()
  await expect(editor).toHaveText(original)
  await expect(reset).toBeDisabled()
  await capture("reset")
  note("Reset used the same Agent undo after reload and restored the imported text.")

  await page.keyboard.press("Escape")
  await trigger.click()
  await context.setOffline(true)
  await expect(tone.getByRole("status")).toHaveText(productCopy.editorOffline)
  await expect(preset).toHaveCount(0)
  await capture("offline")
  await context.setOffline(false)
  await expect(preset).toBeEnabled()

  const usagePath = `**${airaRoutes.usage.path}`
  await page.route(usagePath, async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    await route.fulfill({ response, json: { ...body, usage: { ...body.usage, used: body.usage.allowed } } })
  })
  await page.keyboard.press("Escape")
  await trigger.click()
  await expect(tone.getByRole("status")).toHaveText(/^Available again /)
  expect(requests).toHaveLength(4)
  await page.unroute(usagePath)

  const restoreUsage = await failReply(airaRoutes.usage, { status: 401, json: { ok: false, refusal: "session" } })
  await page.keyboard.press("Escape")
  await trigger.click()
  await expect(tone.getByRole("status")).toHaveText(airaCopy.signIn)
  expect(requests).toHaveLength(4)
  await restoreUsage()
  await page.keyboard.press("Escape")
  await trigger.click()
  const dial = tone.getByRole("button", { name: new RegExp(`^${words.dial}`) })
  await expect(dial).toBeEnabled()
  const beforeDial = await read()
  aira(
    script(
      beforeDial.revision,
      change(
        beforeDial.elements.find((element) => element.node === node),
        first,
      ),
    ),
  )
  await dial.focus()
  await dial.press("ArrowUp")
  await dial.press("ArrowLeft")
  await expect(dial).toHaveAccessibleName(`${words.dial}, ${words.professional}, ${words.concise}`)
  await dial.press("Enter")
  await expect(editor).toHaveText(first)
  expect(requests[4].messages.at(-1).content).toContain(`slide 256. Tone: ${words.professional}, ${words.concise}`)
  await expect(log.getByRole("button", { name: undoCopy.undo, exact: true })).toBeEnabled()
  await log.getByRole("button", { name: undoCopy.undo, exact: true }).click()
  await expect(editor).toHaveText(original)
  note(
    "Offline, signed-out and spent allowance opened a status without dispatching Aira. Keyboard dial mode used slide scope and the Agent panel could undo it.",
  )
  await selectTwoTextBoxes(page)
  const many = page.locator("[data-design-element]")
  const picked = (await many.getAttribute("data-design-element")).split(" ")
  expect(picked).toHaveLength(2)
  await capture("multiple-selected")

  await page.keyboard.press("Control+g")
  await expect(many).toHaveAttribute("data-design-element", /^\d+\.(?:\d+|n[0-9a-z]{12})$/)
  const grouped = await many.getAttribute("data-design-element")
  await capture("group")
  const beforeGroup = await read()
  const groupedText = beforeGroup.elements.filter((element) => picked.includes(element.node))
  expect(groupedText).toHaveLength(2)
  aira(
    script(beforeGroup.revision, ...groupedText.map((element, index) => change(element, index === 0 ? first : second))),
  )
  await trigger.click()
  await expect(dial).toBeEnabled()
  const box = await dial.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.85, { steps: 4 })
  await page.mouse.up()
  await expect(editor).toHaveText([first, second])
  await expect(log.getByRole("button", { name: undoCopy.undo, exact: true })).toBeEnabled()
  const asked = requests[6].messages.at(-1).content
  expect(asked).toContain(`selection ${grouped}. Tone: ${words.casual}, ${words.expanded}`)
  const textLine = asked.split("\n")[1]
  for (const element of picked) expect(textLine).toContain(element)
  await log.getByRole("button", { name: undoCopy.undo, exact: true }).click()
  await expect(editor).toHaveText([original, "Welcome"])
  note("Dragging the dial on a group targeted both text children in one recorded edit. One Agent Undo restored both.")
  const welcome = page.locator('[data-slide-paint] [contenteditable="true"]').last()
  await expect(welcome).toHaveText("Welcome")
  await welcome.click()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveAttribute("data-selection", grouped)
  await page.keyboard.press("Control+Shift+g")
  await expect(page.locator("[data-slide-paint] [data-chosen], [data-slide-paint] [data-selection]")).toHaveCount(0)
  await welcome.click()
  await expect(page.locator("[data-editor-toolbar] [data-text-format]")).toBeVisible()
  const toolbar = page.locator("[data-editor-toolbar]")
  const moreTools = page.locator("[data-toolbar-more]")
  await toolbar.getByRole("button", { name: toolbarCopy.more, exact: true }).click()
  await moreTools.getByRole("button", { name: toolbarCopy.actions, exact: true }).click()
  await page.getByRole("menuitem", { name: toolbarCopy.rewriteThis, exact: true }).hover()
  await capture("text-actions")
  await page.getByRole("menuitem", { name: words.title, exact: true }).click()
  await expect(preset).toBeEnabled()
  await capture("text-tone")
  const before = await read()
  const edited = before.elements.find((element) => element.value !== undefined && readText(element.value) === "Welcome")
  aira(script(before.revision, change(edited, "Greetings, all")))
  await preset.click()
  await expect(welcome).toHaveText("Greetings, all")
  await expect(editor.first()).toHaveText(original)
  await expect(log.getByRole("button", { name: undoCopy.undo, exact: true })).toBeEnabled()
  const lastAsked = requests[8].messages.at(-1).content
  expect(lastAsked).toContain(`selection ${edited.node}. Tone: ${words.presets[0]}`)
  expect(lastAsked.split("\n")[1]).toContain(edited.node)
  expect(lastAsked.split("\n")[1]).not.toContain(node)
  await capture("text-aira-rewrite")
  await log.getByRole("button", { name: undoCopy.undo, exact: true }).click()
  await expect(welcome).toHaveText("Welcome")
  await expect(editor.first()).toHaveText(original)
  note(
    "From the text toolbar, Actions > Rewrite this > Adjust tone rewrote only the layer in hand as one recorded Aira run. One Agent Undo restored it and left the other layer alone.",
  )
}
