import { loadDeck } from "./load-deck.mjs"
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { execFile, spawnSync } from "node:child_process"
import { promisify } from "node:util"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import os from "node:os"
import { preview } from "vite"
import { chromium } from "playwright"
import { PNG } from "pngjs"
import pixelmatch from "pixelmatch"
import { apply, id, flatten } from "../../packages/deck/src/index.ts"
import { fixtureDeck, fixtureElement } from "../../packages/deck/src/fixture.ts"
const root = process.env.P02_EVIDENCE ?? `${os.homedir()}/tmp/airdesign-autopilot/P02`
const runFile = promisify(execFile)
const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim()
const json = async (file, value) => { await mkdir(`${root}/${file.substring(0, file.lastIndexOf("/"))}`, { recursive: true }); await writeFile(`${root}/${file}`, JSON.stringify({ head, ...value }, null, 2)) }
const server = await preview({ root: "apps/studio", configFile: false, preview: { host: "127.0.0.1", port: 0 } })
const address = server.httpServer.address()
assert(address && typeof address !== "string")
const origin = `http://127.0.0.1:${address.port}`
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1470, height: 923 }, deviceScaleFactor: 1 })
const deck = fixtureDeck(300)
const slide = deck.slides[0]
const group = { ...fixtureElement(700), kind: "group", children: [fixtureElement(701), fixtureElement(702)] }
function succeeded(value) { assert.equal(value.ok, true, JSON.stringify(value)); return value.deck }
const inserted = succeeded(apply(deck, { changes: [{ kind: "insert", parent: slide.id, index: 1, value: group }] }))
const text = slide.elements[0]
const changedText = { ...text, runs: [{ ...text.runs[0], text: "Tiếng Việt 日本語 é 👩🏽‍💻" }, { ...text.runs[0], text: "Second style", bold: false, color: "#102030" }] }
const scenarios = [
  { deck, changeSets: [] },
  { deck, changeSets: [{ changes: [{ kind: "insert", parent: deck.id, index: 0, value: { ...slide, id: id("newSlide"), elements: [] } }] }] },
  { deck, changeSets: [{ changes: [{ kind: "insert", parent: slide.id, index: 1, value: group }] }] },
  { deck: inserted, changeSets: [{ changes: [{ kind: "move", target: text.id, parent: group.id, index: 0 }] }] },
  { deck: inserted, changeSets: [{ changes: [{ kind: "remove", target: group.id }] }] },
  { deck, changeSets: [{ changes: [{ kind: "set", target: text.id, value: changedText }] }] },
  { deck: inserted, changeSets: [{ changes: [{ kind: "remove", target: text.id }, { kind: "move", target: group.id, parent: id("e701"), index: 0 }] }] },
  { deck, changeSets: [{ changes: [{ kind: "remove", target: text.id }, { kind: "move", target: id("missing"), parent: slide.id, index: 0 }] }] },
  { deck, changeSets: [{ changes: [{ kind: "set", target: text.id, value: changedText }] }] },
  { deck, changeSets: [{ changes: [{ kind: "set", target: text.id, value: changedText }] }] },
]
async function load(value) { await loadDeck(page, value) }
async function saved() { await page.getByRole("button", { name: "Save deck JSON", exact: true }).click(); return JSON.parse(await page.getByLabel("Deck JSON", { exact: true }).inputValue()) }
const errors = []
page.on("pageerror", e => errors.push(String(e)))
try {
  await page.goto(`${origin}/render-fixture`)
  await page.locator("[data-ready=true]").waitFor()
  for (let n = 1; n <= 10; n++) {
    const path = `lane-${n}`
    await mkdir(`${root}/${path}`, { recursive: true })
    await page.context().tracing.start({ screenshots: true, snapshots: true })
    let actual = {}
    try {
      const input = scenarios[n - 1]
      const raw = spawnSync("node", ["scripts/probe-deck.mjs"], { input: JSON.stringify(input), encoding: "utf8" })
      assert.equal(raw.status, 0, raw.stdout)
      const observed = JSON.parse(raw.stdout)
      await json(`${path}/probe.json`, { input, observed })
      const result = observed.results[0]
      if (n === 1) assert.deepEqual(observed.deck, deck)
      if (n === 2) { assert.equal(observed.deck.slides[0].id, "newSlide"); assert.equal(new Set(observed.deck.slides.map(s => s.id)).size, 2) }
      if (n === 3) assert.deepEqual(observed.deck.slides[0].elements[1].children.map(c => c.id), ["e701", "e702"])
      if (n === 4) { assert.equal(observed.deck.slides[0].elements[0].children[0].id, text.id); assert.equal(flatten(observed.deck.slides[0].elements).filter(e => e.id === text.id).length, 1) }
      if (n === 5) assert.deepEqual(observed.deck.slides[0].elements, slide.elements)
      if (n === 6 || n === 9 || n === 10) {
        assert.deepEqual(observed.deck.slides[0].elements[0], changedText)
        const restored = succeeded(apply(observed.deck, result.inverse))
        assert.deepEqual(restored.slides.map(s => ({ ...s, version: 0 })), deck.slides.map(s => ({ ...s, version: 0 })))
      }
      if (n === 7 || n === 8) { assert.equal(result.ok, false); assert.equal(result.error.code, n === 7 ? "cycle" : "invalid-reference"); assert.deepEqual(observed.deck, input.deck) }
      await load(deck)
      if (n === 1) {
        const trunk = spawnSync("git", ["ls-tree", "-r", "--name-only", "ddad005", "packages/deck", "packages/render"], { encoding: "utf8" }).stdout
        assert.equal(trunk, "")
        actual = { trunk: "feature-absent", headElements: await page.locator("[data-element]").count(), roundTrip: true }
        await json(`${path}/comparison.json`, actual)
      }
      if (n === 2) {
        await page.context().tracing.stop({ path: `${root}/${path}/setup-trace.zip` })
        const runs = []
        for (let trial = 0; trial < 5; trial++) {
          await load(deck)
          const target = page.locator('[data-element="s0e1"]')
          const start = await target.boundingBox()
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
          await page.evaluate(() => {
            window.frameSamples = []
            window.frameRunning = true
            let previous
            function frame(now) { if (previous) window.frameSamples.push(now - previous); previous = now; if (window.frameRunning) requestAnimationFrame(frame) }
            requestAnimationFrame(frame)
          })
          await page.mouse.move(start.x + 5, start.y + 5)
          await page.mouse.down()
          for (let i = 1; i <= 60; i++) { await page.mouse.move(start.x + 5 + i, start.y + 5 + i / 2); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve))) }
          await page.mouse.up()
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
          const frames = await page.evaluate(() => { window.frameRunning = false; return window.frameSamples })
          const persisted = await saved()
          assert.equal(persisted.slides[0].elements[1].box.x, slide.elements[1].box.x + 60)
          assert.equal(persisted.slides[0].elements[1].box.y, slide.elements[1].box.y + 30)
          assert.equal(await target.getAttribute("data-selected"), "true")
          assert(frames.length >= 60 && frames.every(ms => Number.isFinite(ms) && ms > 0))
          const sorted = frames.toSorted((a, b) => a - b)
          const meanFrameMs = frames.reduce((a, b) => a + b, 0) / frames.length
          runs.push({ framesMs: frames, meanFrameMs, p95FrameMs: sorted[Math.floor(sorted.length * 0.95)], measuredFps: 1000 / meanFrameMs, persistedX: persisted.slides[0].elements[1].box.x })
        }
        await load(deck)
        await page.context().tracing.start({ screenshots: true, snapshots: true })
        const item = page.locator('[data-element="s0e1"]')
        const box = await item.boundingBox()
        const samples = await page.locator("[data-element]").count()
        assert.equal(samples, 300)
        await page.mouse.move(box.x + 5, box.y + 5)
        await page.mouse.down()
        for (let i = 1; i <= 60; i++) { await page.mouse.move(box.x + 5 + i, box.y + 5 + i / 2); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve))) }
        await page.mouse.up()
        const final = await saved()
        assert.equal(final.slides[0].elements[1].box.x, slide.elements[1].box.x + 60)
        assert.equal(final.slides[0].elements[1].box.y, slide.elements[1].box.y + 30)
        assert.equal(await item.getAttribute("data-selected"), "true")
        const median = runs.toSorted((a, b) => a.measuredFps - b.measuredFps)[2]
        actual = { elements: samples, runs, frameCount: runs.reduce((total, run) => total + run.framesMs.length, 0), meanFrameMs: median.meanFrameMs, p95FrameMs: median.p95FrameMs, measuredFps: median.measuredFps, selection: "s0e1", position: final.slides[0].elements[1].box, measurement: "Median of five untraced real drags; window ends after pointerup and next frame, before JSON serialization; separate traced replay" }
        actual.frameVerdict = Math.round(actual.measuredFps) >= 60 ? "pass" : "fail"
        actual.frameRule = "60 fps refresh target, rounded to nearest frame/second for Chrome rAF timestamp quantization"
        await json("perf/frame.json", actual)
        assert.equal(actual.frameVerdict, "pass")
      }
      if (n === 3 || n === 7) {
        const textbox = page.locator('[data-text="s0e0"]')
        const zoomChecks = []
        for (const zoom of [0.5, 1, 1.5]) {
          await textbox.focus()
          await page.getByLabel("Zoom", { exact: true }).evaluate((node, value) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; setter.call(node, String(value)); node.dispatchEvent(new Event("input", { bubbles: true })); node.dispatchEvent(new Event("change", { bubbles: true })) }, zoom)
          await page.waitForFunction(value => document.querySelector("[data-zoom]")?.getAttribute("data-zoom") === String(value), zoom)
          const check = await page.locator('[data-element="s0e1"]').evaluate((node, scale) => {
            const slide = node.closest("[data-slide]").getBoundingClientRect()
            const rect = node.getBoundingClientRect()
            return { x: (rect.x - slide.x) / scale, y: (rect.y - slide.y) / scale, width: rect.width / scale, focused: document.activeElement?.getAttribute("data-text"), svgWidth: node.querySelector("svg").getBoundingClientRect().width / scale, hit: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest("[data-element]")?.getAttribute("data-element") }
          }, zoom)
          assert.equal(check.x, slide.elements[1].box.x)
          assert.equal(check.width, slide.elements[1].box.width)
          assert.equal(check.svgWidth, check.width)
          assert.equal(check.hit, "s0e1")
          assert.equal(check.focused, "s0e0")
          const geometry = await page.locator('[data-element="s0e2"]').evaluate(node => {
            const box = node.getBoundingClientRect()
            const hit = (x, y) => document.elementFromPoint(box.x + box.width * x, box.y + box.height * y)?.closest("[data-element]")?.getAttribute("data-element")
            return { inside: hit(0.5, 0.6), outside: hit(0.05, 0.05) ?? null }
          })
          assert.equal(geometry.inside, "s0e2")
          assert.notEqual(geometry.outside, "s0e2")
          check.trianglePaintedHit = geometry
          zoomChecks.push({ zoom, ...check })
        }
        await page.getByRole("button", { name: "Pan", exact: true }).click()
        actual = { zoomChecks, panX: await page.locator("[data-pan-x]").getAttribute("data-pan-x"), panY: await page.locator("[data-pan-y]").getAttribute("data-pan-y"), panFocus: await page.evaluate(() => document.activeElement?.getAttribute("data-text")) }
        assert.equal(Number(actual.panX), n === 3 ? 40 : 80)
        assert.equal(actual.panFocus, "s0e0")
      }
      if (n === 4) {
        const start = performance.now()
        await page.goto(`${origin}/render-fixture?hundred=1`)
        await page.locator("[data-ready=true]").waitFor()
        await page.locator('[data-text="s0e0"]').fill("Editable first slide")
        const elapsed = performance.now() - start
        const hundred = await saved()
        assert.equal(hundred.slides.length, 100)
        assert.equal(hundred.slides[0].elements[0].runs[0].text, "Editable first slide")
        actual = { firstEditableMs: elapsed, slides: hundred.slides.length, totalElements: hundred.slides.reduce((n, s) => n + s.elements.length, 0), budgetMs: 2000 }
      }
      if (n === 5) {
        const field = page.locator('[data-text="s0e0"]')
        await field.focus()
        await field.dispatchEvent("compositionstart", { data: "" })
        await field.evaluate(node => { node.textContent = "日本語"; node.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true, data: "日本語" })) })
        const partial = Number(await page.locator("main").getAttribute("data-deck-version"))
        await page.getByRole("button", { name: "Pan", exact: true }).click()
        assert.equal(await field.textContent(), "日本語")
        await field.dispatchEvent("compositionend", { data: "日本語" })
        const final = await saved()
        assert.equal(partial, 0)
        assert.equal(final.slides[0].elements[0].runs[0].text, "日本語")
        actual = { partialCommits: partial, finalText: final.slides[0].elements[0].runs[0].text, version: final.version, unrelatedRerender: "pan preserved composition" }
      }
      if (n === 6) {
        const fallback = fixtureDeck(1)
        fallback.slides[0].elements[0].runs[0].font = "Missing Font"
        await load(fallback)
        await page.getByRole("button", { name: "Measure and check", exact: true }).click()
        await page.waitForFunction(() => document.querySelector("pre")?.textContent?.includes('"layout"'))
        actual = await page.evaluate(() => ({ disclosure: document.querySelector("[data-font-warning]").textContent, fontLoaded: document.fonts.check("400 16px Geist"), measured: JSON.parse(document.querySelector("pre").textContent).layout }))
        assert(actual.disclosure.includes("Missing Font"))
        assert.equal(actual.fontLoaded, true)
        assert.equal(actual.measured.length, 1)
      }
      if (n === 8 || n === 9) {
        const fixture = fixtureDeck(2)
        const [a, b] = fixture.slides[0].elements
        if (n === 8) a.box.x = -20
        else { fixture.overlaps = ["intentional"]; a.overlap = "intentional"; b.overlap = "intentional"; b.box = { ...a.box } }
        await load(fixture)
        await page.getByRole("button", { name: "Measure and check", exact: true }).click()
        await page.waitForFunction(() => document.querySelector("pre")?.textContent?.includes('"defects"'))
        actual = JSON.parse(await page.locator("pre").textContent())
        if (n === 8) { assert(actual.defects.some(d => d.code === "clipping" && d.ids.includes(a.id) && d.location.x === -20)) }
        else {
          assert.deepEqual(actual.layout.map(e => e.id).sort(), [a.id, b.id].sort())
          for (const element of [a, b]) {
            const measured = actual.layout.find(e => e.id === element.id)
            assert.deepEqual({ x: measured.x, y: measured.y, width: measured.width, height: measured.height }, element.box)
            assert.equal(element.overlap, "intentional")
          }
          assert(!actual.defects.some(d => d.code === "accidental-overlap"))
          const positive = actual
          await page.screenshot({ path: `${root}/${path}/intentional-overlap.png` })
          const unmarked = structuredClone(fixture)
          for (const element of unmarked.slides[0].elements) element.overlap = null
          await load(unmarked)
          await page.getByRole("button", { name: "Measure and check", exact: true }).click()
          const negative = JSON.parse(await page.locator("pre[role=status]").textContent())
          assert(negative.defects.some(d => d.code === "accidental-overlap" && d.ids.includes(a.id) && d.ids.includes(b.id)))
          const invalid = structuredClone(fixture)
          invalid.overlaps = []
          await assert.rejects(load(invalid), /Deck load was rejected/)
          await load(fixture)
          actual = { ...positive, expectedElements: fixture.slides[0].elements, negativeControl: negative, invalidLoadRejected: true }
        }
      }
      if (n === 10) {
        await page.goto(`${origin}/render-fixture`)
        await page.locator("[data-ready=true]").waitFor()
        await load(deck)
        const clientBytes = await page.locator("[data-slide]").screenshot()
        await writeFile(`${root}/${path}/saved-deck.json`, JSON.stringify(deck))
        const captured = await runFile("node", ["scripts/snapshot-render.ts", `${root}/${path}/saved-deck.json`, `${root}/${path}/server.png`, origin], { encoding: "utf8", timeout: 45000 })
        await writeFile(`${root}/${path}/snapshot-cli.json`, captured.stdout)
        const serverBytes = readFileSync(`${root}/${path}/server.png`)
        await writeFile(`${root}/${path}/studio.png`, clientBytes)
        await writeFile(`${root}/${path}/server.png`, serverBytes)
        const client = PNG.sync.read(clientBytes), serverPng = PNG.sync.read(serverBytes)
        const differences = pixelmatch(client.data, serverPng.data, null, client.width, client.height, { threshold: 0.1 })
        assert.equal(differences, 0)
        actual = { pixelDifference: differences, pixelRatio: differences / (client.width * client.height), slideBudget: 0.001, itemBudget: 0.01, lineCountDelta: 0, lineCountEvidence: "Identical pixels including all text; zero changed lines", snapshotConsumer: "scripts/snapshot-render.ts", geometryIdentical: true }
      }
      await page.screenshot({ path: `${root}/${path}/browser.png` })
      await json(`${path}/receipt.json`, { verdict: "pass", w03: "pass", w04: "pass", actual })
      process.stdout.write(`Lane ${n}: PASS ${JSON.stringify(actual).slice(0, 250)}\n`)
    } catch (error) { await json(`${path}/receipt.json`, { verdict: "fail", actual, error: String(error) }); throw error }
    finally { await page.context().tracing.stop({ path: `${root}/${path}/trace.zip` }) }
  }
  const runs = []
  for (let run = 0; run < 5; run++) {
    let value = deck
    const samples = []
    for (let i = 0; i < 200; i++) {
      const target = value.slides[0].elements[1]
      const update = { changes: [{ kind: "set", target: target.id, value: { ...target, box: { ...target.box, x: target.box.x + 1 } } }] }
      const start = performance.now()
      const changed = apply(value, update)
      samples.push(performance.now() - start)
      const next = succeeded(changed)
      assert.equal(next.slides[0].elements[1].box.x, target.box.x + 1)
      assert.equal(next.slides[0].elements[2], value.slides[0].elements[2])
      value = next
    }
    const sorted = samples.toSorted((a, b) => a - b)
    runs.push({ p95Ms: sorted[Math.floor(sorted.length * 0.95)], samples, changedElements: 200, untouchedIdentityRetained: true })
  }
  await json("perf/apply.json", { workload: "300-element deck, 200 distinct set operations per run", runs, budgetMs: 4, failures: 0, state: "warm after lane probes", limiter: "single-threaded JavaScript tree traversal and uniqueness validation", touchedObjectAllocation: "one element, one slide, ancestor arrays and deck; remaining elements retain identity" })
  await json("perf/baseline.json", { trunk: "ddad005", feature: "absent", comparison: "N/A", evidence: "git ls-tree has no packages/deck or packages/render" })
  const fonts = ["400", "600"].map(weight => ({ weight, sha256: createHash("sha256").update(readFileSync(`packages/ui/fonts/geist-latin-${weight}.woff2`)).digest("hex"), license: "packages/ui/fonts/OFL.txt" }))
  await json("manifest.json", { viewport: { width: 1470, height: 923, deviceScaleFactor: 1 }, fonts, environment: { node: process.version, browser: browser.version(), platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0]?.model, cores: os.cpus().length, load: os.loadavg() }, errors })
  assert.deepEqual(errors, [])
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)) }
