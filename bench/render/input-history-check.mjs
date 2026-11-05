import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { preview } from "vite"
import { chromium } from "playwright"
import { fixtureDeck } from "../../packages/deck/src/fixture.ts"
import { loadDeck } from "./load-deck.mjs"
const output = process.env.P02_HISTORY_OUTPUT ?? `${process.env.HOME}/tmp/airdesign-autopilot/P02/fix3/history.json`
await mkdir(output.substring(0, output.lastIndexOf("/")), { recursive: true })
const results = { head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), cases: [], errors: [] }
const server = await preview({ root: "apps/studio", configFile: false, preview: { host: "127.0.0.1", port: 0 } })
const origin = `http://127.0.0.1:${server.httpServer.address().port}`
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ permissions: ["clipboard-read", "clipboard-write"], viewport: { width: 1470, height: 923 } })
  page.on("pageerror", error => results.errors.push(error.message))
  await page.goto(`${origin}/render-fixture`)
  await page.locator("[data-ready=true]").waitFor()
  const field = page.locator("[data-text]")
  const deck = fixtureDeck(1)
  const base = deck.slides[0].elements[0].runs[0]
  deck.slides[0].elements[0].runs = [{ ...base, text: "Alpha ", bold: true, color: "#ff0000" }, { ...base, text: "Beta", bold: false, color: "#0000ff" }]
  const original = deck.slides[0].elements[0].runs
  async function stored() {
    await page.getByRole("button", { name: "Save deck JSON", exact: true }).click()
    return JSON.parse(await page.getByLabel("Deck JSON").inputValue())
  }
  async function selectBeta() {
    await loadDeck(page, deck)
    await field.focus()
    await field.evaluate(node => { const text = node.lastChild.firstChild; document.getSelection().setBaseAndExtent(text, 0, text, 4) })
  }
  async function check(name, action) {
    const observed = { name }
    try { await action(observed); observed.verdict = "pass" }
    catch (error) { observed.verdict = "fail"; observed.error = String(error) }
    results.cases.push(observed)
  }
  async function history(observed) {
    observed.after = await field.textContent()
    await page.keyboard.press("ControlOrMeta+Z")
    observed.undo = await field.textContent()
    await page.keyboard.press("ControlOrMeta+Shift+Z")
    observed.redo = await field.textContent()
    await page.keyboard.type("!")
    observed.continued = await field.textContent()
    await field.screenshot({ path: `${output.substring(0, output.lastIndexOf("/"))}/${observed.name}.png` })
    const saved = await stored()
    observed.runs = saved.slides[0].elements[0].runs
    assert.equal(observed.after, "Alpha New")
    assert.equal(observed.undo, "Alpha Beta")
    assert.equal(observed.redo, "Alpha New")
    assert.equal(observed.continued, "Alpha New!")
    assert.deepEqual(observed.runs, [original[0], { ...original[1], text: "New!" }])
    await page.reload()
    await loadDeck(page, saved)
    assert.equal(await field.textContent(), "Alpha New!")
    assert.deepEqual((await stored()).slides[0].elements[0].runs, observed.runs)
  }
  for (let trial = 0; trial < 3; trial++) await check(`keyboard-rich-paste-${trial}`, async observed => {
    await selectBeta()
    await page.evaluate(async () => navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob(["New"], { type: "text/plain" }), "text/html": new Blob(['<span style="color:green;font-size:70px">New</span>'], { type: "text/html" }) })]))
    await page.keyboard.press("ControlOrMeta+V")
    await history(observed)
  })
  await check("programmatic-insertHTML-history", async observed => {
    await selectBeta()
    const inserted = await page.evaluate(() => document.execCommand("insertHTML", false, '<span style="color:green;font-size:70px">New</span>'))
    assert.equal(inserted, true)
    await history(observed)
  })
  for (const inputType of ["insertFromPaste", "insertFromDrop", "insertReplacementText", "insertFromYank"]) await check(inputType, async observed => {
    await selectBeta()
    observed.cancelled = await field.evaluate((node, inputType) => {
      const data = new DataTransfer()
      data.setData("text/html", '<span style="color:green;font-size:70px">New</span>')
      data.setData("text/plain", "New")
      return !node.dispatchEvent(new InputEvent("beforeinput", { inputType, dataTransfer: data, bubbles: true, cancelable: true }))
    }, inputType)
    await history(observed)
    assert.equal(observed.cancelled, true)
  })
  for (const fallback of [false, true]) await check(`real-unfocused-drop${fallback ? "-fallback" : ""}`, async observed => {
    await loadDeck(page, deck)
    await page.locator("#drag-source").evaluateAll(nodes => nodes.forEach(node => node.remove()))
    await page.evaluate(() => {
      const source = document.createElement("div")
      source.id = "drag-source"
      source.draggable = true
      source.textContent = "DRAG NEW"
      source.addEventListener("dragstart", event => { event.dataTransfer.setData("text/plain", "New"); event.dataTransfer.setData("text/html", "<b>New</b>") })
      document.querySelector("h1").after(source)
    })
    const textarea = page.getByLabel("Deck JSON")
    await textarea.focus()
    const json = await textarea.inputValue()
    const point = await field.evaluate(node => {
      const range = document.createRange()
      range.setStart(node.lastChild.firstChild, 2)
      range.collapse(true)
      const rect = range.getBoundingClientRect()
      const box = node.getBoundingClientRect()
      return { x: rect.x - box.x, y: rect.y + rect.height / 2 - box.y }
    })
    if (fallback) await page.evaluate(() => { document.caretPositionFromPoint = undefined })
    await page.locator("#drag-source").dragTo(field, { targetPosition: point })
    observed.after = await field.textContent()
    observed.textareaUnchanged = await textarea.inputValue() === json
    observed.targetFocused = await field.evaluate(node => node.ownerDocument.activeElement === node)
    await page.keyboard.type("!")
    observed.continued = await field.textContent()
    observed.source = await page.locator("#drag-source").textContent()
    await field.screenshot({ path: `${output.substring(0, output.lastIndexOf("/"))}/${observed.name}.png` })
    const saved = await stored()
    observed.runs = saved.slides[0].elements[0].runs
    assert.equal(observed.after, "Alpha BeNewta")
    assert.equal(observed.continued, "Alpha BeNew!ta")
    assert.equal(observed.textareaUnchanged, true)
    assert.equal(observed.targetFocused, true)
    assert.equal(observed.source, "DRAG NEW")
    assert.deepEqual(observed.runs, [original[0], { ...original[1], text: "BeNew!ta" }])
    await loadDeck(page, saved)
    assert.equal(await field.textContent(), "Alpha BeNew!ta")
  })
  assert.deepEqual(results.errors, [])
} finally {
  await writeFile(output, JSON.stringify(results, null, 2))
  await browser.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
process.stdout.write(`${JSON.stringify(results)}\n`)
assert(results.cases.every(result => result.verdict === "pass"))
