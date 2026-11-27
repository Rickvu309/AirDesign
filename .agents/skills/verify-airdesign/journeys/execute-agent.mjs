import { expect } from "@playwright/test"
import { airaCopy, airaStepWords, undoCopy } from "../bin/product-copy.mjs"
import { connectOutsideAgent } from "./aira-panel.mjs"
import { readDoom, selectNode } from "../look/doom-deck.mjs"
import { addSlides, entries } from "../look/doom-slides.mjs"

const built = (slide) => `
const s = insert({ kind: "slide", after: ${JSON.stringify(slide)} })
const title = insert({ parent: s, kind: "text", textStyle: "title", text: "Enterprise drove most of the growth", box: { x: 120, y: 80, w: 1680, h: 140 } })
const rows = [["Enterprise", 18.6], ["Mid-market", 14.9], ["SMB", 7.9]]
const most = Math.max(...rows.map(([, value]) => value))
const widths = rows.map(([label, value], i) => {
  const y = 320 + i * 160
  const w = Math.round((1100 * value) / most)
  insert({ parent: s, kind: "text", textStyle: "body", text: label, alignV: "center", box: { x: 120, y, w: 300, h: 112 } })
  insert({ parent: s, kind: "shape", shape: "rect", name: label, fill: i === 0 ? "accent1" : "background2", box: { x: 440, y: y + 20, w, h: 72 } })
  insert({ parent: s, kind: "text", textStyle: "body", text: "$" + value + "M", alignV: "center", box: { x: 460 + w, y, w: 240, h: 112 } })
  return w
})
const measured = get({ target: title }).box
insert({ parent: s, kind: "text", textStyle: "caption", text: "Source: FY26 segment report", box: { x: 120, y: 960, w: 1200, h: 48 } })
screenshot({ target: s })
;({ slide: s, widths, title: measured, problems: get({ target: s }).problems.length })`

export default async function drive(kit) {
  const { signIn, page, context, capture, note, doomRoutes, airaRoutes, aira } = kit
  const { cookie } = await signIn()
  await page.goto("/s")
  await page.locator("[data-editor-ready]").waitFor()
  const deck = new URL(page.url()).pathname.slice("/s/".length)
  const opened = { deck, cookie }
  const first = Object.values((await readDoom(kit, opened)).fold.nodes).find((node) => node.type === "slide").id
  const canvas = page.locator("[data-slide-box]")
  const call = await connectOutsideAgent(kit, cookie, "Script agent")
  const originalTitle = canvas.locator("[data-node]").first()
  const layer = await originalTitle.getAttribute("data-node")
  await selectNode(page, layer)
  await expect
    .poll(() => call("get_app_state", {}))
    .toMatchObject({
      decks: [{ deck }],
      openDeck: { deck, selection: { slide: first, ids: [layer] } },
    })
  note("The OAuth agent saw the open deck and the selected layer in structured content.")

  const started = Date.now()
  const agent = await call("execute", { deck, script: built(first) })
  expect(agent, JSON.stringify(agent)).toMatchObject({ ok: true, problems: [] })
  const { slide, widths, title, problems } = agent.result
  expect(problems).toBe(0)
  expect(widths).toEqual([1100, 881, 467])
  expect(title.h).toBeGreaterThan(60)
  expect(agent).not.toHaveProperty("made")
  expect(agent.screenshots).toEqual([slide])
  const elapsed = Date.now() - started
  const saved = (await readDoom(kit, opened)).fold
  const layers = Object.values(saved.nodes).filter((node) => node.parent?.id === slide)
  expect(layers).toHaveLength(11)
  note(
    `An agent over OAuth built a slide of ${String(layers.length)} layers in one execute call in ${String(elapsed)} ms, bars ${widths.join("/")} px from the values, the title measured at ${String(Math.round(title.w))}x${String(Math.round(title.h))} with the served fonts, 0 problems, and a screenshot from this tab.`,
  )
  const bars = Object.values(saved.nodes).filter(
    (node) =>
      node.parent?.id === slide &&
      ["Enterprise", "Mid-market", "SMB"].includes(node.name) &&
      node.geometry?.kind === "rect",
  )
  expect(bars.map((bar) => Math.round(bar.box.w)).sort((a, b) => b - a)).toEqual(widths)
  await entries(page).nth(1).click()
  await expect(canvas.getByText("Enterprise drove most of the growth", { exact: true })).toBeVisible()
  await capture("agent-built-slide")

  expect((await call("stop_run", { deck, runId: agent.runId })).ok).toBe(true)
  const undone = await call("undo_run", { deck, runId: agent.runId })
  expect(undone, JSON.stringify(undone)).toMatchObject({ ok: true })
  await expect(entries(page)).toHaveCount(1)
  await expect(canvas.getByText("Enterprise drove most of the growth", { exact: true })).toHaveCount(0)
  await capture("agent-run-undone")
  note("undo_run took the whole script back as one step: the slide left the canvas and the filmstrip.")

  aira([{ name: "read-slide-guides.sse" }, { name: "build-slide.sse", fill: { deck } }, { name: "built-slide.sse" }])
  const side = page.locator("[data-editor-panel]")
  const log = side.getByRole("log")
  const composer = side.getByRole("textbox", { name: airaCopy.askAira })
  const guides = page.waitForRequest((request) => {
    if (new URL(request.url()).pathname !== airaRoutes.turn.path) return false
    const answers = request.postDataJSON().messages.at(-1)?.content
    return Array.isArray(answers) && answers.some((answer) => answer.tool_use_id === "toolu_fixture_slides")
  })
  await composer.fill("Add a slide on Q3 revenue: renewals $61M, new logos $37M, expansion $22M.")
  await page.keyboard.press("Enter")
  const answers = (await guides).postDataJSON().messages.at(-1).content
  const answer = (name) => JSON.parse(answers.find((block) => block.tool_use_id === `toolu_fixture_${name}`).content)
  expect(answer("state")).toMatchObject({ ok: true, openDeck: { deck } })
  expect(answer("slides")).toMatchObject({
    ok: true,
    name: "slides",
    text: expect.stringContaining("# Designing slides"),
  })
  expect(answer("execute")).toMatchObject({ ok: true, name: "execute" })
  expect(answer("kit")).toMatchObject({ ok: true, name: "kit", text: expect.stringContaining("kit/title-block") })
  await expect(log.locator('[data-tool-state="done"]').getByText(airaStepWords.execute.done)).toBeVisible()
  await expect(
    log.getByText("The new slide shows renewals ahead of new logos and expansion.", { exact: true }),
  ).toBeVisible()
  await expect(entries(page)).toHaveCount(2)
  await entries(page).nth(1).click()
  await expect(canvas.getByText("Renewals carried the quarter", { exact: true })).toBeVisible()
  const airaSaved = (await readDoom(kit, opened)).fold
  const airaTitle = Object.values(airaSaved.nodes).find((node) => node.text?.chars === "Renewals carried the quarter")
  expect(airaSaved.nodes[airaTitle?.parent?.id]?.name).toBe("Title block")
  await capture("aira-built-slide")
  await log.getByRole("button", { name: undoCopy.undo }).click()
  await expect(entries(page)).toHaveCount(1)
  await expect(canvas.getByText("Renewals carried the quarter", { exact: true })).toHaveCount(0)
  await expect.poll(async () => (await readDoom(kit, opened)).fold.nodes[airaTitle.id]?.parent).toBeNull()
  await capture("aira-run-undone")
  note(
    "Aira read the shared guides over MCP and copied the kit title block in execute. Chat Undo removed the slide from the filmstrip and the saved deck.",
  )

  const paths = new Set([doomRoutes.edit.path, doomRoutes.since.path])
  const offline = (url) => paths.has(url.pathname)
  const fail = (route) => route.abort("internetdisconnected")
  await page.route(offline, fail)
  await addSlides(page, 1)
  const late = await call("execute", {
    deck,
    script: `insert({ parent: ${JSON.stringify(first)}, kind: "text", text: "Written while the tab was offline", box: { x: 120, y: 700, w: 1200, h: 80 } })`,
  })
  expect(late, JSON.stringify(late)).toMatchObject({ ok: true })
  await capture("offline-both-wrote")
  await page.unroute(offline, fail)
  await page.evaluate(() => dispatchEvent(new Event("online")))
  await expect(page.locator('[data-save-status="saved"]')).toBeAttached()
  await entries(page).first().click()
  await expect(canvas.getByText("Written while the tab was offline", { exact: true })).toBeVisible()
  const after = (await readDoom(kit, opened)).fold
  const slides = Object.values(after.nodes).filter((node) => node.type === "slide" && node.parent)
  expect(slides).toHaveLength(2)
  await capture("offline-replayed")
  note(
    "While the tab was offline the person added a slide and the agent's execute landed; on reconnect the tab replayed its slide and painted the agent's text, and the server holds both.",
  )
  await call("stop_run", { deck, runId: late.runId })
  const second = await context.newPage()
  await second.goto("/s")
  await second.locator("[data-editor-ready]").waitFor()
  const other = new URL(second.url()).pathname.slice("/s/".length)
  await expect.poll(() => call("get_app_state", {})).toMatchObject({ openDeck: { deck: other } })
  await second.close()
  await expect.poll(() => call("get_app_state", {})).toMatchObject({ openDeck: { deck } })
  await page.goto("/")
  await expect
    .poll(() => call("get_app_state", {}))
    .toMatchObject({
      decks: expect.arrayContaining([{ deck, name: expect.any(String), rev: expect.any(Number) }]),
      openDeck: null,
    })
  note("Closing the newer tab returned the other deck. Leaving the editor then returned no open deck.")
}
