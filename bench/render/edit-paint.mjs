import { preview } from "vite"
import { chromium } from "playwright"
import { writeFile, mkdir } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import os from "node:os"
import assert from "node:assert/strict"
const root = `${os.homedir()}/tmp/airdesign-autopilot/P02/perf`
await mkdir(root, { recursive: true })
const server = await preview({ root: "apps/studio", configFile: false, preview: { host: "127.0.0.1", port: 0 } })
const address = server.httpServer.address()
const browser = await chromium.launch()
try {
  const cold = []
  for (let i = 0; i < 5; i++) {
    const trial = await browser.newPage({ viewport: { width: 1470, height: 923 } })
    const start = performance.now()
    await trial.goto(`http://127.0.0.1:${address.port}/render-fixture?hundred=1`)
    await trial.locator("[data-ready=true]").waitFor()
    assert.equal(await trial.locator("[contenteditable=true]").count(), 1)
    assert((await trial.locator(".render-controls").textContent()).includes("100 slides"))
    cold.push({ firstEditableMs: performance.now() - start, slides: 100, renderedElements: await trial.locator("[data-element]").count(), context: "fresh cache and font cache" })
    await trial.close()
  }
  await writeFile(`${root}/startup.json`, JSON.stringify({ head: spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim(), cold, budgetMs: 2000, verdict: cold.every(c => c.firstEditableMs <= 2000) ? "pass" : "fail" }, null, 2))
  const page = await browser.newPage({ viewport: { width: 1470, height: 923 } })
  const session = await page.context().newCDPSession(page)
  await page.goto(`http://127.0.0.1:${address.port}/render-fixture`)
  await page.locator("[data-ready=true]").waitFor()
  assert.equal(await page.locator("[data-element]").count(), 300)
  const events = []
  session.on("Tracing.dataCollected", data => events.push(...data.value))
  await session.send("Tracing.start", { categories: "devtools.timeline,blink.user_timing", transferMode: "ReportEvents" })
  const samples = []
  for (let i = 0; i < 100; i++) {
    samples.push(await page.evaluate(index => new Promise(resolve => {
      const field = document.querySelector("[data-text]")
      field.focus()
      performance.mark(`edit-${index}`)
      const start = performance.now()
      field.textContent = `Edit ${index}`
      field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: String(index) }))
      requestAnimationFrame(() => setTimeout(() => resolve({ nextPaintTaskMs: performance.now() - start, text: field.textContent, version: Number(document.querySelector("main").getAttribute("data-deck-version")) }), 0))
    }), i))
    assert.equal(samples[i].text, `Edit ${i}`)
    assert.equal(samples[i].version, i + 1)
  }
  const complete = new Promise(resolve => session.once("Tracing.tracingComplete", resolve))
  await session.send("Tracing.end")
  await complete
  const paints = []
  for (let i = 0; i < samples.length; i++) {
    const mark = events.find(e => e.name === `edit-${i}`)
    const paint = events.find(e => e.name === "Paint" && e.ts >= mark?.ts)
    if (mark && paint) paints.push({ index: i, paintMs: (paint.ts + (paint.dur ?? 0) - mark.ts) / 1000 })
  }
  const sorted = paints.map(p => p.paintMs).toSorted((a, b) => a - b)
  const p95 = sorted[Math.floor(sorted.length * 0.95)]
  await writeFile(`${root}/edit-trace.json`, JSON.stringify(events))
  await writeFile(`${root}/edit-paint.json`, JSON.stringify({ head: spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim(), workload: "100 native text inputs in a 300-element production fixture", samples, paints, p95PaintMs: p95, budgetMs: 16, verdict: paints.length === 100 && p95 <= 16 ? "pass" : "fail", limiter: "Chrome refresh cadence plus main-thread style/layout/paint; timings include tracing overhead", failures: 0, comparableTrunk: false }, null, 2))
  process.stdout.write(`${JSON.stringify({ samples: samples.length, paints: paints.length, p95PaintMs: p95, budgetMs: 16 })}\n`)
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)) }
