import assert from "node:assert/strict"
import { preview } from "vite"
import { chromium } from "playwright"
import { fixtureDeck } from "../../packages/deck/src/fixture.ts"
import { snapshot } from "../../packages/render/src/server.ts"
import { PNG } from "pngjs"
import pixelmatch from "pixelmatch"
const server = await preview({ root: "apps/studio", configFile: false, preview: { host: "127.0.0.1", port: 0 } })
const address = server.httpServer.address()
assert(address && typeof address !== "string")
const origin = `http://127.0.0.1:${address.port}`
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1470, height: 923 } })
  const errors = []
  page.on("pageerror", e => errors.push(String(e)))
  await page.goto(`${origin}/render-fixture`)
  await page.locator("[data-ready=true]").waitFor()
  assert.equal(await page.locator("[data-element]").count(), 300)
  assert.equal(await page.locator('[contenteditable=true]').count(), 1)
  const title = page.locator('[data-text="s0e0"]')
  assert.equal(await title.getAttribute("aria-label"), "Text · A clear direction")
  await title.focus()
  await page.getByRole("button", { name: "Pan", exact: true }).click()
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-text")), "s0e0")
  await page.getByRole("button", { name: "Pan", exact: true }).click()
  const paintedHits = await page.locator('[data-element="s0e2"]').evaluate(node => {
    const rect = node.getBoundingClientRect()
    const hit = (x, y) => document.elementFromPoint(rect.x + rect.width * x, rect.y + rect.height * y)?.closest("[data-element]")?.getAttribute("data-element")
    return { inside: hit(0.5, 0.6), outside: hit(0.05, 0.05) }
  })
  assert.equal(paintedHits.inside, "s0e2")
  assert.notEqual(paintedHits.outside, "s0e2")
  await title.dispatchEvent("compositionstart", { data: "" })
  await title.evaluate(node => { node.textContent = "日本"; node.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true, data: "日本" })) })
  assert.equal(await page.locator("main").getAttribute("data-deck-version"), "0")
  await title.dispatchEvent("compositionend", { data: "日本" })
  await page.waitForFunction(() => document.querySelector("main")?.getAttribute("data-deck-version") === "1")
  assert.equal(await title.textContent(), "日本")
  const sameNode = await page.locator('[data-element="s0e2"]').evaluate(node => { node.dataset.identity = "untouched"; return true })
  assert(sameNode)
  await page.locator('[data-element="s0e2"]').evaluate(node => { window.untouchedMutations = 0; new MutationObserver(records => { window.untouchedMutations += records.length }).observe(node, { subtree: true, attributes: true, childList: true, characterData: true }) })
  await title.fill("A clear direction")
  assert.equal(await page.locator('[data-element="s0e2"]').getAttribute("data-identity"), "untouched")
  assert.equal(await page.evaluate(() => window.untouchedMutations), 0)
  await page.getByRole("button", { name: "Save deck JSON", exact: true }).click()
  const editedDeck = JSON.parse(await page.getByLabel("Deck JSON", { exact: true }).inputValue())
  await title.blur()
  const edited = PNG.sync.read(await page.locator("[data-slide]").screenshot())
  const editedServer = PNG.sync.read(Buffer.from(await snapshot({ deck: editedDeck, slideId: editedDeck.slides[0].id, origin })))
  assert.equal(pixelmatch(edited.data, editedServer.data, null, edited.width, edited.height, { threshold: 0.1 }), 0)
  await page.getByLabel("Deck JSON", { exact: true }).fill(JSON.stringify(fixtureDeck(300)))
  await page.getByRole("button", { name: "Load saved deck", exact: true }).click()
  await page.locator("[data-ready=true]").waitFor()
  const studio = PNG.sync.read(await page.locator("[data-slide]").screenshot())
  const serverImage = PNG.sync.read(Buffer.from(await snapshot({ deck: fixtureDeck(300), slideId: fixtureDeck(300).slides[0].id, origin })))
  const pixels = pixelmatch(studio.data, serverImage.data, null, studio.width, studio.height, { threshold: 0.1 })
  assert.equal(pixels, 0)
  assert.deepEqual(errors, [])
  const unavailable = await browser.newPage()
  await unavailable.route("**/*.woff2", route => route.abort())
  await unavailable.goto(`${origin}/render-fixture`)
  await unavailable.waitForFunction(() => document.querySelector("pre")?.textContent?.includes("Error"))
  assert.equal(await unavailable.locator("[data-ready=true]").count(), 0)
  await unavailable.close()
  process.stdout.write(`${JSON.stringify({ elements: 300, imePartialCommits: 0, untouchedNodeRetained: true, pixelDifference: pixels, browser: browser.version() })}\n`)
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)) }
