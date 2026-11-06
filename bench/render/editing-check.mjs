import { loadDeck } from "./load-deck.mjs"
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { preview } from "vite"
import { chromium } from "playwright"
import { PNG } from "pngjs"
import pixelmatch from "pixelmatch"
import { fixtureDeck, fixtureElement } from "../../packages/deck/src/fixture.ts"
import { snapshot } from "../../packages/render/src/server.ts"
const output = `${process.env.HOME}/tmp/airdesign-autopilot/P02/fix2`
await mkdir(output, { recursive: true })
const server = await preview({ root: "apps/studio", configFile: false, preview: { host: "127.0.0.1", port: 0 } })
const origin = `http://127.0.0.1:${server.httpServer.address().port}`
const browser = await chromium.launch()
const results = { head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), cases: [] }
try {
  const page = await browser.newPage({ viewport: { width: 1470, height: 923 } })
  const errors = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto(`${origin}/render-fixture`)
  await page.locator("[data-ready=true]").waitFor()
  const field = page.locator("[data-text]")
  async function load(deck) { await loadDeck(page, deck) }
  async function saved() {
    await page.getByRole("button", { name: "Save deck JSON", exact: true }).click()
    return JSON.parse(await page.getByLabel("Deck JSON").inputValue())
  }
  async function parity(name, expectedText) {
    const deck = await saved()
    const runs = deck.slides[0].elements[0].runs
    assert.equal(runs.map(r => r.text).join(""), expectedText, await field.innerHTML())
    await field.blur()
    const live = PNG.sync.read(await page.locator("[data-slide]").screenshot({ path: `${output}/${name}.png` }))
    const captured = PNG.sync.read(Buffer.from(await snapshot({ deck, slideId: deck.slides[0].id, origin })))
    const pixels = pixelmatch(live.data, captured.data, null, live.width, live.height, { threshold: 0.1 })
    assert.equal(pixels, 0, `${name} snapshot parity`)
    await load(deck)
    assert.equal(await field.innerText(), expectedText)
    assert.equal(await field.locator("div,p,br").count(), 0, `${name} reload restores canonical run spans`)
    results.cases.push({ name, runs, differingPixels: pixels })
    return deck
  }
  const invalid = fixtureDeck(2)
  invalid.slides[0].elements[0].overlap = "missing"
  await assert.rejects(load(invalid), /Deck load was rejected/)
  results.cases.push({ name: "invalid-load-rejects-stale-ready", rejected: true })
  for (const action of ["bold-shortcut", "styled-html", "paste", "drop"]) {
    await load(fixtureDeck(1))
    await field.focus()
    await page.keyboard.press("ControlOrMeta+A")
    if (action === "bold-shortcut") {
      await page.keyboard.press("ControlOrMeta+B")
      await page.keyboard.type("Toggle")
    } else if (action === "styled-html") {
      await page.evaluate(() => document.execCommand("insertHTML", false, '<span style="color:red;font-size:70px;font-style:italic">Pasted</span>'))
    } else {
      await field.evaluate((node, type) => {
        const data = new DataTransfer()
        data.setData("text/html", '<b style="color:red">Pasted</b>')
        data.setData("text/plain", "Pasted")
        node.dispatchEvent(type === "paste" ? new InputEvent("beforeinput", { inputType: "insertFromPaste", bubbles: true, cancelable: true, dataTransfer: data }) : new InputEvent("beforeinput", { inputType: "insertFromDrop", bubbles: true, cancelable: true, dataTransfer: data }))
      }, action)
    }
    await parity(action, action === "bold-shortcut" ? "Toggle" : "Pasted")
  }
  await load(fixtureDeck(1))
  const cancelled = await field.evaluate(node => ["formatBold", "formatItalic", "formatUnderline", "formatStrikeThrough", "formatJustifyCenter", "formatRemove"].map(inputType => !node.dispatchEvent(new InputEvent("beforeinput", { inputType, bubbles: true, cancelable: true }))))
  assert(cancelled.every(Boolean))
  results.cases.push({ name: "all-native-format-types-cancelled", cancelled })
  for (const action of ["styled-html", "paste", "drop"]) {
    const deck = fixtureDeck(1)
    const run = deck.slides[0].elements[0].runs[0]
    deck.slides[0].elements[0].runs = [{ ...run, text: "Alpha ", color: "#ff0000" }, { ...run, text: "Beta", color: "#0000ff", bold: false }]
    await load(deck)
    await field.focus()
    await field.evaluate(node => {
      const text = node.lastChild.firstChild
      document.getSelection().setBaseAndExtent(text, 0, text, 4)
    })
    if (action === "styled-html") await page.evaluate(() => document.execCommand("insertHTML", false, '<span style="color:green;font-size:70px">Pasted</span>'))
    else await field.evaluate((node, type) => {
      const data = new DataTransfer()
      data.setData("text/html", '<b style="color:green">Pasted</b>')
      data.setData("text/plain", "Pasted")
      node.dispatchEvent(type === "paste" ? new InputEvent("beforeinput", { inputType: "insertFromPaste", bubbles: true, cancelable: true, dataTransfer: data }) : new InputEvent("beforeinput", { inputType: "insertFromDrop", bubbles: true, cancelable: true, dataTransfer: data }))
    }, action)
    await page.keyboard.type("!")
    const changed = await parity(`caret-${action}`, "Alpha Pasted!")
    assert.equal(changed.slides[0].elements[0].runs.at(-1).color, "#0000ff")
    assert.equal(changed.slides[0].elements[0].runs.at(-1).bold, false)
  }
  const styled = fixtureDeck(1)
  const run = styled.slides[0].elements[0].runs[0]
  styled.slides[0].elements[0].runs = [{ ...run, text: "Alpha ", bold: true, color: "#ff0000" }, { ...run, text: "Beta", bold: false, color: "#0000ff" }]
  await load(styled)
  await field.focus()
  await page.keyboard.press("ControlOrMeta+End")
  await page.keyboard.type("!")
  const edited = await parity("styled-typing", "Alpha Beta!")
  assert.equal(edited.slides[0].elements[0].runs.length, 2)
  assert.equal(edited.slides[0].elements[0].runs[1].color, "#0000ff")
  await field.focus()
  await page.keyboard.press("ControlOrMeta+End")
  await field.dispatchEvent("compositionstart")
  await page.keyboard.insertText("日本語 👩🏽‍💻")
  await field.dispatchEvent("compositionend")
  await parity("styled-composition", "Alpha Beta!日本語 👩🏽‍💻")
  await field.focus()
  await page.keyboard.press("ControlOrMeta+End")
  await page.keyboard.press("Enter")
  await page.keyboard.press("Enter")
  await page.keyboard.type("Tail")
  const multilineStyled = await parity("styled-enter", "Alpha Beta!日本語 👩🏽‍💻\n\nTail")
  assert.equal(multilineStyled.slides[0].elements[0].runs.at(-1).color, "#0000ff")
  for (const key of ["Enter", "Shift+Enter"]) {
    const empty = fixtureDeck(1)
    empty.slides[0].elements[0].runs[0].text = ""
    await load(empty)
    await field.focus()
    await page.keyboard.type("First")
    await page.keyboard.press(key)
    await page.keyboard.type("Second")
    await parity(key === "Enter" ? "enter" : "shift-enter", "First\nSecond")
  }
  const empty = fixtureDeck(1)
  empty.slides[0].elements[0].runs[0].text = ""
  await load(empty)
  await field.focus()
  await page.keyboard.type("Hello")
  await parity("empty-box", "Hello")
  await load(empty)
  await field.focus()
  await page.keyboard.type("First")
  await page.keyboard.press("Enter")
  await page.keyboard.press("Enter")
  await parity("trailing-blank-lines", "First\n\n")
  await load(empty)
  await field.focus()
  await page.evaluate(() => document.execCommand("insertHTML", false, "<div>Pasted</div><div><br></div><div>日本語</div>"))
  await parity("multiline-paste", "Pasted\n\n日本語")
  await load(empty)
  await field.focus()
  await field.dispatchEvent("compositionstart")
  await page.keyboard.insertText("日本語\nSecond")
  await field.dispatchEvent("compositionend")
  await parity("multiline-composition", "日本語\nSecond")
  const themed = fixtureDeck(1)
  themed.themes[0].background = "#123456"
  themed.themes[0].font = "MissingThemeFont"
  await load(themed)
  assert.equal(await page.locator("[data-slide]").evaluate(n => getComputedStyle(n).backgroundColor), "rgb(18, 52, 86)")
  assert.match(await page.locator("[data-font-warning]").innerText(), /MissingThemeFont/)
  await page.screenshot({ path: `${output}/theme-change.png` })
  const grouped = fixtureDeck(0)
  const child = { ...fixtureElement(1), box: { x: 80, y: 0, width: 40, height: 40 } }
  grouped.slides[0].elements = [{ ...fixtureElement(2), kind: "group", box: { x: 100, y: 100, width: 50, height: 50 }, children: [child] }, { ...fixtureElement(3), box: { x: 180, y: 100, width: 40, height: 40 } }]
  await load(grouped)
  await page.getByRole("button", { name: "Measure and check" }).click()
  assert.match(await page.locator("pre").innerText(), /accidental-overlap/)
  await page.screenshot({ path: `${output}/group-overlap.png` })
  for (const font of ["Geist", "MissingPrintFont"]) {
    const deck = fixtureDeck(1)
    deck.slides[0].elements[0].runs[0].font = font
    await load(deck)
    await page.emulateMedia({ media: "print" })
    const box = await page.locator("[data-slide]").boundingBox()
    assert.equal(box.x, 0)
    assert.equal(box.y, 0)
    assert.equal(box.width, 960)
    assert.equal(box.height, 540)
    if (font !== "Geist") assert.equal(await page.locator("[data-font-warning]").isVisible(), false)
    await page.screenshot({ path: `${output}/print-${font}.png` })
    const pdf = Buffer.from(await snapshot({ deck, slideId: deck.slides[0].id, origin, format: "pdf" }))
    const text = pdf.toString("latin1")
    const pages = (text.match(/\/Type \/Page\b/g) ?? []).length
    assert.equal(pages, 1)
    const mediaBox = text.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/)
    assert(mediaBox, "PDF page size is present")
    assert(Math.abs(Number(mediaBox[1]) - 720) <= 0.25)
    assert(Math.abs(Number(mediaBox[2]) - 405) <= 0.25)
    await writeFile(`${output}/print-${font}.pdf`, pdf)
    results.cases.push({ name: `print-${font}`, pages, mediaBox: mediaBox.slice(1).map(Number), box, diagnosticVisible: false })
    await page.emulateMedia({ media: "screen" })
  }
  assert.deepEqual(errors, [])
  await writeFile(`${output}/browser-results.json`, JSON.stringify(results, null, 2))
  process.stdout.write(`${JSON.stringify(results)}\n`)
} finally {
  await browser.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
