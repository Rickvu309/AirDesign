import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { openBrowser } from "../.agents/skills/verify-airdesign/bin/browser.mjs"
import { browserCookies } from "../.agents/skills/verify-airdesign/bin/browser-cookies.mjs"
import { PNG } from "pngjs"
import { deckParts, fetchRefs, thumbnailOf } from "./fidelity-refs.mjs"
import { takeMachineLock } from "./machine-lock.mjs"
import {
  chosenSlides,
  compareSmall,
  fidelityFailure,
  fidelityLines,
  paintSize,
  powerpointLines,
  reported,
  scaleDown,
} from "./paint-fidelity.mjs"
import { readCorpus } from "./pptx-corpus.mjs"
import { heatmap, slideBar, slideDiff } from "./slide-diff.mjs"
import { readMachine, renderCache, renderCacheFolder, renderCode, renderPages, renderSettings } from "./pptx-render.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const corpus = path.join(root, "scripts/pptx-fixtures/corpus")
const soffice = process.env.PPTX_SOFFICE ?? "soffice"
const pdftoppm = "pdftoppm"
const runLimit = 15 * 60 * 1000
const renderLimit = 5 * 60 * 1000
const paintLimit = 60 * 1000
const worstKept = 5
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

const verify = path.join(root, ".agents/skills/verify-airdesign/bin/verify-airdesign.mjs")
const lastJson = (text) => JSON.parse(text.trim().split("\n").at(-1))

const opened = async (page, file) => {
  await page.goto("/")
  const before = page.url()
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForFunction((previous) => location.href !== previous, before, { timeout: paintLimit })
  await page.waitForFunction(
    () => {
      const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
      return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
    },
    undefined,
    { timeout: paintLimit },
  )
}

const shownSlide = async (page, number, aspect, size) => {
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
  if (size === undefined) return slide.screenshot({ animations: "disabled" })
  const before = await slide.evaluate((node, width) => {
    const kept = node.style.cssText
    node.style.zoom = String(width / node.offsetWidth)
    node.style.position = "fixed"
    node.style.left = "0"
    node.style.top = "0"
    const alone = document.createElement("style")
    alone.id = "paint-fidelity-alone"
    alone.textContent =
      "body *:not(:has([data-slide-paint])):not([data-slide-paint]):not([data-slide-paint] *) { visibility: hidden !important }"
    document.head.append(alone)
    return kept
  }, size.width)
  const bytes = await slide.screenshot({ animations: "disabled" })
  await slide.evaluate((node, kept) => {
    node.style.cssText = kept
    document.getElementById("paint-fidelity-alone")?.remove()
  }, before)
  const image = PNG.sync.read(bytes)
  if (image.width !== size.width || image.height !== size.height)
    throw new Error(`painted ${image.width}x${image.height}, reference ${size.width}x${size.height}`)
  return bytes
}

const paintedSlide = async (page, number, aspect) => PNG.sync.read(await shownSlide(page, number, aspect))

const compareDeck = async ({ browser, origin, cookies, name, hashes, rows, skipped }) => {
  const context = await browser.newContext({ baseURL: origin, viewport, reducedMotion: "reduce" })
  try {
    await context.addCookies(cookies)
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

const genericFamilies = ["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "emoji", "math"]

const slideFonts = (page) =>
  page.evaluate((generic) => {
    const unquoted = (name) => name.trim().replace(/^["']|["']$/g, "")
    const pageFamilies = new Set(
      getComputedStyle(document.documentElement).getPropertyValue("--font-sans").split(",").map(unquoted),
    )
    const slide = document.querySelector("[data-slide-paint]")
    const stacks = new Set()
    const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode())
      if (node.textContent.trim() !== "" && node.parentElement !== null)
        stacks.add(getComputedStyle(node.parentElement).fontFamily)
    for (const node of slide.querySelectorAll("[data-paragraph]")) {
      const before = getComputedStyle(node, "::before")
      if (before.content !== "none" && before.content !== "normal") stacks.add(before.fontFamily)
    }
    const context = document.createElement("canvas").getContext("2d")
    const width = (font) => {
      context.font = font
      return context.measureText("mmmmmmmmmmlliWQ@ 0123").width
    }
    const shown = (family) =>
      ["monospace", "serif"].some((fallback) => width(`40px "${family}", ${fallback}`) !== width(`40px ${fallback}`))
    const missing = new Set()
    for (const stack of stacks) {
      const names = stack
        .split(",")
        .map(unquoted)
        .filter((name) => name !== "" && !pageFamilies.has(name) && !generic.includes(name))
      if (names.length > 0 && !names.some(shown)) missing.add(names[0])
    }
    return { families: [...stacks], missing: [...missing] }
  }, genericFamilies)

const decodedJpeg = async (page, bytes) => {
  const image = await page.evaluate(async (data) => {
    const picture = new Image()
    picture.src = `data:image/jpeg;base64,${data}`
    await picture.decode()
    const canvas = document.createElement("canvas")
    canvas.width = picture.naturalWidth
    canvas.height = picture.naturalHeight
    const context = canvas.getContext("2d")
    context.drawImage(picture, 0, 0)
    return {
      width: canvas.width,
      height: canvas.height,
      data: [...context.getImageData(0, 0, canvas.width, canvas.height).data],
    }
  }, Buffer.from(bytes).toString("base64"))
  return { ...image, data: Uint8Array.from(image.data) }
}

const pdfPages = async (deck, folder) => {
  const out = path.join(folder, path.basename(deck.name, ".pptx"))
  fs.mkdirSync(out, { recursive: true })
  const size = ["-scale-to-x", String(deck.width), "-scale-to-y", String(deck.height)]
  await run(pdftoppm, ["-png", ...size, deck.pdfFile, path.join(out, "page")])
  const number = (name) => Number(name.match(/\d+/)[0])
  return fs
    .readdirSync(out)
    .filter((name) => /^page-\d+\.png$/.test(name))
    .sort((left, right) => number(left) - number(right))
    .map((name) => path.join(out, name))
}

const keepWorst = (kept, entry) => {
  if (entry.row.match || entry.row.missing.length > 0) return
  kept.push(entry)
  kept.sort((left, right) => left.row.worst.score - right.row.worst.score)
  kept.splice(worstKept)
}

const judgeDeck = async ({ browser, origin, cookies, deck, rows, skipped, kept }) => {
  const context = await browser.newContext({ baseURL: origin, viewport, deviceScaleFactor: 1, reducedMotion: "reduce" })
  let page
  try {
    await context.addCookies(cookies)
    page = await context.newPage()
    page.setDefaultTimeout(paintLimit)
    await opened(page, deck.file)
    const count = await page.locator("[data-slide-entry]").count()
    if (deck.slides !== undefined && count !== deck.slides) {
      skipped.push({ deck: deck.name, reason: `${count} slides painted and ${deck.slides} in PowerPoint's pdf` })
      return
    }
    for (const reference of deck.references) {
      const image = await reference.image(page)
      const painted = await shownSlide(page, reference.slide, `${image.width} / ${image.height}`, image)
      const { families, missing } = await slideFonts(page)
      const { width, height, ...diff } = slideDiff(image, PNG.sync.read(painted))
      const row = { deck: deck.name, slide: reference.slide, ...diff, families, missing }
      rows.push(row)
      say(
        `paint-fidelity measured ${deck.name} slide ${reference.slide}: ${diff.score.toFixed(3)}, ${missing.length} missing fonts; requested ${families.join("; ")}`,
      )
      if (deck.slides === undefined || reference.slide === 1) {
        const stem = path.join(evidence, `${path.basename(deck.name, ".pptx")}-${reference.slide}`)
        const png = new PNG({ width: image.width, height: image.height })
        png.data = Buffer.from(image.data)
        fs.writeFileSync(`${stem}-powerpoint.png`, PNG.sync.write(png))
        fs.writeFileSync(`${stem}-painted.png`, painted)
      }
      keepWorst(kept, { row, image, painted })
    }
  } catch (error) {
    if (page !== undefined) {
      const stem = path.join(evidence, path.basename(deck.name, ".pptx"))
      await page.screenshot({ path: `${stem}-failed.png` }).catch(() => undefined)
      fs.writeFileSync(
        `${stem}-failed.txt`,
        await page
          .locator("body")
          .innerText()
          .catch(() => "page closed"),
      )
    }
    skipped.push({ deck: deck.name, reason: error instanceof Error ? error.message.split("\n")[0] : String(error) })
  } finally {
    await context.close()
  }
}

const powerpointDecks = async ({ names, folder }) => {
  const refs = await fetchRefs()
  const wanted = (name) => names.length === 0 || names.includes(name)
  const thumbnails = []
  for (const entry of refs.thumbnails.filter((row) => wanted(row.deck))) {
    const file = path.join(corpus, entry.deck)
    const bytes = thumbnailOf(await deckParts(file))
    thumbnails.push({ name: entry.deck, file, references: [{ slide: 1, image: (page) => decodedJpeg(page, bytes) }] })
  }
  const pdfs = []
  for (const deck of refs.decks.filter((row) => wanted(row.name))) {
    const pages = await pdfPages(deck, folder)
    pdfs.push({
      name: deck.name,
      file: deck.pptxFile,
      slides: deck.slides,
      references: pages.map((page, index) => ({
        slide: index + 1,
        image: async () => PNG.sync.read(fs.readFileSync(page)),
      })),
    })
  }
  return [...thumbnails, ...pdfs]
}

const writeWorst = (kept) => {
  if (kept.length === 0) return
  const png = (image) => {
    const out = new PNG({ width: image.width, height: image.height })
    out.data = Buffer.from(image.data)
    return PNG.sync.write(out)
  }
  for (const { row, image, painted } of kept) {
    const stem = path.join(evidence, `${path.basename(row.deck, ".pptx")}-${row.slide}`)
    fs.writeFileSync(`${stem}-powerpoint.png`, png(image))
    fs.writeFileSync(`${stem}-painted.png`, painted)
    fs.writeFileSync(`${stem}-heatmap.png`, png(heatmap(image, PNG.sync.read(painted))))
  }
  say(`paint-fidelity worst heatmaps: ${evidence}`)
}

const signedInStack = async () => {
  stack = lastJson(await run("node", [verify, "launch"]))
  const signedIn = lastJson(await run("node", [verify, "sign-in", stack.run]))
  browser = await openBrowser()
  return { origin: stack.origin, cookies: browserCookies([signedIn.cookie]) }
}

const say = (line) => console.log(line)
const argv = process.argv.slice(2)
const flag = argv.indexOf("--reference")
const reference = flag === -1 ? "powerpoint" : argv[flag + 1]
if (reference !== "powerpoint" && reference !== "libreoffice") {
  console.error("paint-fidelity takes --reference powerpoint (the default) or --reference libreoffice")
  process.exit(1)
}
let names = argv.filter((_, index) => flag === -1 || (index !== flag && index !== flag + 1))
const rows = []
const skipped = []
const kept = []
const evidence = path.join(os.homedir(), "tmp/paint-fidelity", new Date().toISOString().replace(/[:.]/g, "-"))
fs.mkdirSync(evidence, { recursive: true })
const pagesFolder = fs.mkdtempSync(path.join(os.tmpdir(), "paint-fidelity-"))
let decks = 0
let stack
let browser

const libreofficeWork = async () => {
  if (names.length === 0) names = readCorpus(root).map((deck) => deck.name)
  decks = names.length
  const pages = await renderDecks({ names, skipped, say })
  const { origin, cookies } = await signedInStack()
  for (const [name, hashes] of pages) await compareDeck({ browser, origin, cookies, name, hashes, rows, skipped })
}

const powerpointWork = async () => {
  const judged = await powerpointDecks({ names, folder: pagesFolder })
  decks = judged.length
  const { origin, cookies } = await signedInStack()
  for (const deck of judged) await judgeDeck({ browser, origin, cookies, deck, rows, skipped, kept })
}

await takeMachineLock({ job: "paint-fidelity" })
const outcome = await reported({
  limit: runLimit,
  say,
  work: reference === "powerpoint" ? powerpointWork : libreofficeWork,
})

const recorded = JSON.parse(fs.readFileSync(path.join(root, "metrics.json"), "utf8"))["paint-fidelity"]
const now = reference === "powerpoint" ? recorded.now : 0
const lines =
  reference === "powerpoint"
    ? powerpointLines({ rows, skipped, decks, goal: recorded.goal, now, bar: slideBar })
    : fidelityLines({ rows, skipped, decks, goal: rows.length, title: "paint-fidelity against LibreOffice" })
for (const line of lines) say(line)
fs.writeFileSync(path.join(evidence, "scores.json"), JSON.stringify({ reference, rows, skipped, outcome }, null, 2))
say(`paint-fidelity evidence: ${evidence}`)
writeWorst(kept)
fs.rmSync(pagesFolder, { recursive: true, force: true })
await browser?.close().catch(() => undefined)
if (stack !== undefined)
  await run("node", [verify, "stop", stack.run]).catch(() => say("paint-fidelity stack was already gone"))
const failure = fidelityFailure({ rows, skipped, outcome, now })
if (failure !== undefined) console.error(failure)
process.exit(failure === undefined ? 0 : 1)
