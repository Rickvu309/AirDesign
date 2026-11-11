import { execFile, spawn } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "@playwright/test"
import { PNG } from "pngjs"
import { takeMachineLock } from "./machine-lock.mjs"
import { chosenSlides, compareSmall, fidelityLines, paintSize, reported, scaleDown } from "./paint-fidelity.mjs"
import { readCorpus } from "./pptx-corpus.mjs"
import { readMachine, renderCache, renderCacheFolder, renderCode, renderPages, renderSettings } from "./pptx-render.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const corpus = path.join(root, "scripts/pptx-fixtures/corpus")
const soffice = process.env.PPTX_SOFFICE ?? "soffice"
const pdftoppm = "pdftoppm"
const runLimit = 15 * 60 * 1000
const renderLimit = 5 * 60 * 1000
const paintLimit = 60 * 1000
const viewport = { width: 1600, height: 900 }
const pixelFolder = path.join(renderCacheFolder, `pixels-${paintSize.width}x${paintSize.height}`)

const pixelFile = (hash) => path.join(pixelFolder, `${hash}.rgb`)
const shapeBytes = 4
const readKept = (hash) => {
  const kept = fs.readFileSync(pixelFile(hash))
  return {
    aspect: `${kept.readUInt16BE(0)} / ${kept.readUInt16BE(2)}`,
    small: new Uint8Array(kept.subarray(shapeBytes)),
  }
}

const run = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { cwd: root, env: process.env, maxBuffer: 64 * 1024 * 1024, timeout: renderLimit },
      (error, stdout, stderr) => {
        if (error) reject(new Error((stderr || stdout || `${command} failed`).trim()))
        else resolve(stdout)
      },
    )
  })

const keepPixels = (folder) => {
  fs.mkdirSync(pixelFolder, { recursive: true })
  for (const name of fs.readdirSync(folder).filter((entry) => /^page-\d+\.png$/.test(entry))) {
    const bytes = fs.readFileSync(path.join(folder, name))
    const hash = createHash("sha256").update(bytes).digest("hex")
    const image = PNG.sync.read(bytes)
    const shape = Buffer.alloc(shapeBytes)
    shape.writeUInt16BE(image.width, 0)
    shape.writeUInt16BE(image.height, 2)
    fs.writeFileSync(pixelFile(hash), Buffer.concat([shape, scaleDown(image)]))
  }
}

const runKeepingPixels = async (command, args) => {
  const output = await run(command, args)
  if (command === pdftoppm) keepPixels(path.dirname(args.at(-1)))
  return output
}

const renderWithPixels = (file) => renderPages(file, { soffice, pdftoppm, run: runKeepingPixels })

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.once("error", reject)
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })

const answered = async (origin) => {
  const giveUp = Date.now() + paintLimit
  while (Date.now() < giveUp) {
    const up = await fetch(origin).then(
      (response) => response.ok,
      () => false,
    )
    if (up) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`${origin} did not answer`)
}

const opened = async (page, file) => {
  await page.goto("/thin")
  const before = page.url()
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForFunction((previous) => location.href !== previous, before, { timeout: paintLimit })
  await page.waitForFunction(
    () => {
      const deck = location.pathname.match(/^\/thin\/([A-Za-z0-9_-]{1,64})$/)?.[1]
      return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
    },
    undefined,
    { timeout: paintLimit },
  )
}

const paintedSlide = async (page, number, aspect) => {
  const entry = page.locator(`[data-slide-entry="${number}"]`)
  await entry.click()
  await page.waitForFunction(
    (wanted) => document.querySelector(`[data-slide-entry="${wanted}"]`)?.getAttribute("aria-current") === "true",
    number,
  )
  const slide = page.locator("[data-slide-paint]")
  await slide.evaluate(async (node, wanted) => {
    node.style.aspectRatio = wanted
    await document.fonts.ready
    await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)))
  }, aspect)
  return PNG.sync.read(await slide.screenshot({ animations: "disabled" }))
}

const compareDeck = async ({ browser, origin, name, hashes, rows, skipped }) => {
  const context = await browser.newContext({ baseURL: origin, viewport, reducedMotion: "reduce" })
  try {
    const page = await context.newPage()
    page.setDefaultTimeout(paintLimit)
    await opened(page, path.join(corpus, name))
    const count = await page.locator("[data-slide-entry]").count()
    if (count !== hashes.length) {
      skipped.push({ deck: name, reason: `${count} slides painted and ${hashes.length} pages rendered` })
      return
    }
    if ((await page.locator("[data-slide-paint]").count()) === 0) {
      skipped.push({ deck: name, reason: "no painted slide on the page" })
      return
    }
    for (const slide of chosenSlides(count)) {
      const render = readKept(hashes[slide - 1])
      const painted = scaleDown(await paintedSlide(page, slide, render.aspect))
      rows.push({ deck: name, slide, ...compareSmall(render.small, painted) })
    }
  } catch (error) {
    skipped.push({ deck: name, reason: error instanceof Error ? error.message.split("\n")[0] : String(error) })
  } finally {
    await context.close()
  }
}

const renderDecks = async ({ names, skipped, say }) => {
  const machine = await readMachine({ soffice, pdftoppm, env: process.env })
  const renders = renderCache({
    folder: renderCacheFolder,
    machine,
    settings: renderSettings,
    code: renderCode(),
    render: renderWithPixels,
  })
  const pages = new Map()
  const waiting = [...names]
  const renderNext = async () => {
    for (let name = waiting.shift(); name !== undefined; name = waiting.shift()) {
      const file = path.join(corpus, name)
      try {
        const hashes = await renders.pages({ file, bytes: fs.readFileSync(file), use: "cached" })
        const kept = hashes.every((hash) => fs.existsSync(pixelFile(hash)))
        pages.set(name, kept ? hashes : await renderWithPixels(file))
      } catch (error) {
        skipped.push({ deck: name, reason: error instanceof Error ? error.message.split("\n")[0] : String(error) })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(os.availableParallelism(), 4) }, renderNext))
  say(renders.line())
  return pages
}

const say = (line) => console.log(line)
let names = process.argv.slice(2)
const rows = []
const skipped = []
let server
let browser

await reported({
  limit: runLimit,
  say,
  work: async () => {
    if (names.length === 0) names = readCorpus(root).map((deck) => deck.name)
    await takeMachineLock()
    await run("pnpm", ["--filter", "web", "build"])
    const pages = await renderDecks({ names, skipped, say })
    const port = await freePort()
    const origin = `http://127.0.0.1:${port}`
    server = spawn(
      "pnpm",
      ["--filter", "web", "exec", "vite", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
      { cwd: root, stdio: "ignore", detached: true },
    )
    await answered(origin)
    browser = await chromium.launch()
    for (const [name, hashes] of pages) await compareDeck({ browser, origin, name, hashes, rows, skipped })
  },
})

for (const line of fidelityLines({ rows, skipped, decks: names.length })) say(line)
await browser?.close().catch(() => undefined)
if (server?.pid !== undefined) {
  try {
    process.kill(-server.pid)
  } catch {
    say("paint-fidelity server was already gone")
  }
}
process.exit(0)
