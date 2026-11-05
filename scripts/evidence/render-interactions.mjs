import { chromium } from "playwright"
import { preview } from "vite"
import { spawnSync } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import os from "node:os"
import assert from "node:assert/strict"
import { fixtureDeck } from "../../packages/deck/src/fixture.ts"
const root = `${os.homedir()}/tmp/airdesign-autopilot/P02/review`
await mkdir(root, { recursive: true })
const server = await preview({ root: "apps/studio", configFile: false, preview: { host: "127.0.0.1", port: 0 } })
const address = server.httpServer.address()
const origin = `http://127.0.0.1:${address.port}`
const browser = await chromium.launch({ args: ["--remote-debugging-port=41994"] })
const context = await browser.newContext({ viewport: { width: 1470, height: 923 }, recordVideo: { dir: root, size: { width: 1470, height: 923 } } })
const page = await context.newPage()
function screenshot(name) {
  const captured = spawnSync("agent-browser", ["--session", "p02-render-evidence", "--cdp", "http://127.0.0.1:41994", "screenshot", `${root}/${name}.png`], { encoding: "utf8", env: { ...process.env, TMPDIR: `${os.homedir()}/tmp` } })
  assert.equal(captured.status, 0, captured.stderr)
  return captured.stdout
}
try {
  await page.goto(`${origin}/render-fixture`)
  await page.locator("[data-ready=true]").waitFor()
  assert.equal(await page.locator("[data-element]").count(), 300)
  screenshot("fixture")
  const rect = await page.locator('[data-element="s0e1"]').boundingBox()
  await page.mouse.move(rect.x + 5, rect.y + 5)
  await page.mouse.down()
  for (let i = 1; i <= 60; i++) { await page.mouse.move(rect.x + 5 + i * 2, rect.y + 5 + i); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve))) }
  await page.mouse.up()
  screenshot("drag")
  for (const value of [0.5, 0.7, 1, 1.2]) {
    await page.getByLabel("Zoom", { exact: true }).evaluate((node, zoom) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(node, String(zoom)); node.dispatchEvent(new Event("input", { bubbles: true })); node.dispatchEvent(new Event("change", { bubbles: true })) }, value)
    await page.getByRole("button", { name: "Pan", exact: true }).click()
  }
  screenshot("zoom-pan")
  const field = page.getByRole("textbox", { name: "Text s0e0", exact: true })
  await field.focus()
  await field.dispatchEvent("compositionstart", { data: "" })
  await field.evaluate(node => { node.textContent = "日本語"; node.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true })) })
  screenshot("ime")
  await field.dispatchEvent("compositionend", { data: "日本語" })
  const fallback = fixtureDeck(300)
  fallback.slides[0].elements[0].runs[0].font = "Missing Font"
  await page.getByLabel("Deck JSON", { exact: true }).fill(JSON.stringify(fallback))
  await page.getByRole("button", { name: "Load saved deck", exact: true }).click()
  await page.locator("[data-ready=true]").waitFor()
  screenshot("font-fallback")
  await page.getByLabel("Deck JSON", { exact: true }).fill('{"invalid":"deck"}')
  await page.getByRole("button", { name: "Load saved deck", exact: true }).click()
  assert((await page.locator("pre").textContent()).includes("Invalid canonical deck"))
  screenshot("invalid-deck")
  await writeFile(`${root}/capture.json`, JSON.stringify({ head: spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim(), viewport: { width: 1470, height: 923 }, screenshotTool: "agent-browser CLI attached to Chrome CDP", video: await page.video().path(), errors: 0 }, null, 2))
} finally {
  spawnSync("agent-browser", ["--session", "p02-render-evidence", "close"], { encoding: "utf8" })
  await context.close().catch(() => {})
  await browser.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
