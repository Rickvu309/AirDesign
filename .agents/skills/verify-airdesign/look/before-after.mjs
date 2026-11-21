import { existsSync, writeFileSync } from "node:fs"
import { registerHooks } from "node:module"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { PNG } from "pngjs"
import { designContext, designViewport, settle } from "../bin/browser.mjs"
import { crop } from "./images.mjs"
import { aimAt, relative } from "./placement.mjs"
import { find, reach } from "./states.mjs"

const skillPath = ".agents/skills/verify-airdesign"
const ownStates = fileURLToPath(new URL("./states.mjs", import.meta.url))

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
  if (path.resolve(theirs) === ownStates || !existsSync(theirs)) return { reach: own, lacks: () => false }
  const registry = await import(pathToFileURL(theirs).href)
  const has = (name) => registry.states?.some((each) => each.name === name) === true
  return {
    reach: (name) => (has(name) ? (kit) => registry.reach(registry.find(name), { ...kit, journeys }) : own(name)),
    lacks: (name) => Array.isArray(registry.states) && !has(name),
  }
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
        if (rect.width > 0 && rect.height > 0 && style.visibility !== "hidden") {
          const range = document.createRange()
          range.selectNodeContents(element)
          const words = range.getBoundingClientRect()
          return {
            box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            ink: { x: words.x, y: words.y, width: words.width, height: words.height },
          }
        }
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
    for (const element of document.querySelectorAll("svg, img, input, textarea")) {
      if (element.parentElement?.closest("svg") != null) continue
      const rect = element.getBoundingClientRect()
      if (rect.width > 1 && rect.height > 1)
        found.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
    }
    return found
  })
}

const clickWait = 2_000

export async function clickEach(page, selectors) {
  const skipped = []
  for (const selector of selectors) {
    const target = page.locator(selector).first()
    const shown = await target.waitFor({ state: "visible", timeout: clickWait }).then(
      () => true,
      () => false,
    )
    if (shown) await target.click()
    else skipped.push(selector)
  }
  return skipped
}

export async function captureSide({ browser, side, block, runtime }) {
  const context = await browser.newContext({ ...designContext, baseURL: side.origin })
  try {
    const page = await context.newPage()
    page.setDefaultTimeout(20_000)
    const { kit, out } = await runtime.journeyKit({ run: side.run, name: `${block.state}-${side.key}`, page, context })
    try {
      await side.driver.reach(block.state)({ ...kit, out, repo: side.repo })
    } catch (error) {
      return {
        error: String(error?.message ?? error).split("\n")[0],
        outcome: side.driver.lacks(block.state) ? "new" : "failed",
      }
    }
    const skipped = await clickEach(page, block.click)
    await settle(page)
    const full = await page.screenshot({ animations: "disabled" })
    const viewport = page.viewportSize() ?? designViewport
    const places = await measure(page, [
      block.crop ?? { x: 0, y: 0, ...viewport },
      ...block.callouts.map((callout) => callout.at),
    ])
    const broken = places.find((place) => place.error)
    if (broken) throw new Error(`${block.state}: ${broken.error}`)
    const [frame, ...boxes] = places.map((place, index) =>
      index === 0 || block.callouts[index - 1].target === "element" ? place.box : aimAt(place.box, place.ink ?? null),
    )
    const texts = await textBoxes(page)
    return { full, frame, boxes, texts, skipped, viewport, outcome: "captured" }
  } finally {
    await context.close()
  }
}

function sharedFrame(shots) {
  const reached = shots.filter((shot) => !shot.error)
  const viewportOf = (shot) => shot.viewport ?? designViewport
  const whole = { x: 0, y: 0, ...(reached[0] ? viewportOf(reached[0]) : designViewport) }
  const frames = reached.map((shot) => shot.frame ?? { x: 0, y: 0, ...viewportOf(shot) })
  const x = Math.min(...frames.map((box) => box.x))
  const y = Math.min(...frames.map((box) => box.y))
  const right = Math.max(...frames.map((box) => box.x + box.width))
  const bottom = Math.max(...frames.map((box) => box.y + box.height))
  return { whole, seen: relative({ x, y, width: right - x, height: bottom - y }, whole) }
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
  const viewportOf = (shot) => shot.viewport ?? designViewport
  const { whole, seen } = sharedFrame(shots)
  const frame = seen ?? whole
  if (block.crop !== null && reached.every(({ shot }) => shot.frame === null))
    warnings.push(`${block.state}: crop ${JSON.stringify(block.crop)} found nothing; showing the whole frame`)
  const drawn = reached.map(({ side, shot }) => {
    const image = PNG.sync.read(shot.full)
    for (const [index, box] of shot.boxes.entries()) {
      if (box === null) continue
      const visible = relative(box, frame)
      if (visible === null || visible.width < box.width || visible.height < box.height)
        warnings.push(
          `${block.state}: callout ${String(index + 1)} ${JSON.stringify(block.callouts[index]?.at)} is ${visible === null ? "outside" : "clipped by"} the crop on ${side.label || side.key}; widen the crop`,
        )
    }
    return {
      key: side.key,
      label: side.label,
      missing: side.missing,
      png: crop(image, frame, image.width / viewportOf(shot).width, 0),
      boxes: shot.boxes.map((box) => relative(box, frame)),
      texts: (shot.texts ?? []).map((box) => relative(box, frame)).filter((box) => box !== null),
    }
  })
  const badges = { new: "New in this PR", failed: `Failed on ${sides[0].name}` }
  return {
    warnings,
    block: {
      state: block.state,
      title: block.title,
      badge:
        sides.length > 1 && badges[shots[0].outcome]
          ? { text: badges[shots[0].outcome], outcome: shots[0].outcome }
          : null,
      width: frame.width,
      height: frame.height,
      callouts: block.callouts,
      sides: drawn,
    },
  }
}

const calloutRoom = 32

export function calloutCrops(block, sides, shots) {
  const frame = sharedFrame(shots).seen
  if (frame === null) return []
  return shots.flatMap((shot, at) => {
    if (shot.error) return []
    const image = PNG.sync.read(shot.full)
    return shot.boxes.flatMap((box, index) => {
      if (relative(box, frame) === null) return []
      const top = Math.max(frame.y, box.y - calloutRoom)
      const bottom = Math.min(frame.y + frame.height, box.y + box.height + calloutRoom)
      const strip = { x: frame.x, y: top, width: frame.width, height: bottom - top }
      return [
        {
          number: index + 1,
          note: block.callouts[index]?.note,
          side: sides[at].key,
          png: crop(image, strip, image.width / (shot.viewport ?? designViewport).width, 0),
        },
      ]
    })
  })
}

export function fullNames(blocks) {
  const seen = new Map()
  return blocks.map(({ state }) => {
    const count = (seen.get(state) ?? 0) + 1
    seen.set(state, count)
    return count === 1 ? state : `${state}-${String(count)}`
  })
}

export function saveFull(out, state, side, shot) {
  if (shot.error) return null
  const file = path.join(out, `${state}-${side.key}.png`)
  writeFileSync(file, shot.full)
  return file
}
