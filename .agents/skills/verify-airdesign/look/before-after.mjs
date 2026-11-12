import { existsSync, writeFileSync } from "node:fs"
import { registerHooks } from "node:module"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { PNG } from "pngjs"
import { designContext, designViewport, settle } from "../bin/browser.mjs"
import { crop } from "./images.mjs"
import { relative } from "./placement.mjs"
import { find, reach } from "./states.mjs"

const skillPath = ".agents/skills/verify-airdesign"
const ownStates = fileURLToPath(new URL("./states.mjs", import.meta.url))
const wholeFrame = { x: 0, y: 0, ...designViewport }

let shared = false

function sharePlaywright() {
  if (shared) return
  shared = true
  const ours = import.meta.resolve("@playwright/test")
  registerHooks({
    resolve: (specifier, context, next) =>
      specifier === "@playwright/test" ? { url: ours, shortCircuit: true } : next(specifier, context),
  })
}

export async function driverFor(repo) {
  sharePlaywright()
  const theirs = path.join(repo, skillPath, "look/states.mjs")
  const journeys = path.join(repo, skillPath, "journeys")
  const own = (name) => (kit) => reach(find(name), { ...kit, journeys })
  if (path.resolve(theirs) === ownStates || !existsSync(theirs)) return own
  const registry = await import(pathToFileURL(theirs).href)
  return (name) =>
    registry.states?.some((each) => each.name === name)
      ? (kit) => registry.reach(registry.find(name), { ...kit, journeys })
      : own(name)
}

async function measure(page, places) {
  return page.evaluate((places) => {
    return places.map((place) => {
      if (typeof place !== "string") return { box: place }
      let found
      try {
        found = [...document.querySelectorAll(place)]
      } catch {
        return { error: `"${place}" is not a valid CSS selector` }
      }
      for (const element of found) {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        if (rect.width > 0 && rect.height > 0 && style.visibility !== "hidden")
          return { box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }
      }
      return { box: null }
    })
  }, places)
}

async function textBoxes(page) {
  return page.evaluate(() => {
    const found = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode() && found.length < 3000) {
      const node = walker.currentNode
      const parent = node.parentElement
      if (parent === null || node.textContent.trim() === "" || parent.closest("script,style") !== null) continue
      const style = getComputedStyle(parent)
      if (style.visibility === "hidden" || style.display === "none") continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const rect of range.getClientRects())
        if (rect.width > 1 && rect.height > 1)
          found.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
    }
    return found
  })
}

export async function captureSide({ browser, side, block, runtime }) {
  const context = await browser.newContext({ ...designContext, baseURL: side.origin })
  try {
    const page = await context.newPage()
    page.setDefaultTimeout(20_000)
    const { kit, out } = await runtime.journeyKit({ run: side.run, name: `${block.state}-${side.key}`, page, context })
    try {
      await side.driver(block.state)({ ...kit, out, repo: side.repo })
    } catch (error) {
      return { error: String(error?.message ?? error).split("\n")[0] }
    }
    const skipped = []
    for (const selector of block.click) {
      const target = page.locator(selector).first()
      if (await target.isVisible().catch(() => false)) await target.click()
      else skipped.push(selector)
    }
    await settle(page)
    const full = await page.screenshot({ animations: "disabled" })
    const places = await measure(page, [block.crop ?? wholeFrame, ...block.callouts.map((callout) => callout.at)])
    const broken = places.find((place) => place.error)
    if (broken) throw new Error(`${block.state}: ${broken.error}`)
    const [frame, ...boxes] = places.map((place) => place.box)
    const texts = await textBoxes(page)
    return { full, frame, boxes, texts, skipped }
  } finally {
    await context.close()
  }
}

export function composeBlock(block, sides, shots) {
  const warnings = []
  const reached = sides.map((side, index) => ({ side, shot: shots[index] })).filter(({ shot }) => !shot.error)
  for (const [index, shot] of shots.entries()) {
    if (shot.error)
      warnings.push(`${block.state} not reached on ${sides[index].label || sides[index].key}: ${shot.error}`)
    for (const selector of shot.skipped ?? [])
      warnings.push(`${block.state}: click ${selector} found nothing on ${sides[index].label || sides[index].key}`)
  }
  const found = reached.map(({ shot }) => shot.frame).findLast((each) => each !== null)
  const frame = relative(found ?? wholeFrame, wholeFrame) ?? wholeFrame
  if (block.crop !== null && reached.every(({ shot }) => shot.frame === null))
    warnings.push(`${block.state}: crop ${JSON.stringify(block.crop)} found nothing; showing the whole frame`)
  const scale = (image) => image.width / designViewport.width
  const drawn = reached.map(({ side, shot }) => {
    const image = PNG.sync.read(shot.full)
    return {
      key: side.key,
      label: side.label,
      missing: side.missing,
      png: crop(image, frame, scale(image), 0),
      boxes: shot.boxes.map((box) => relative(box, frame)),
      texts: shot.texts.map((box) => relative(box, frame)).filter((box) => box !== null),
    }
  })
  const fresh = sides.length > 1 && shots[0].error !== undefined
  return {
    warnings,
    block: {
      state: block.state,
      title: block.title,
      badge: fresh ? "New in this PR" : null,
      width: frame.width,
      height: frame.height,
      callouts: block.callouts,
      sides: drawn,
    },
  }
}

export function saveFull(out, state, side, shot) {
  if (shot.error) return null
  const file = path.join(out, `${state}-${side.key}.png`)
  writeFileSync(file, shot.full)
  return file
}
