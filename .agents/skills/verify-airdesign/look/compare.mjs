import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { PNG } from "pngjs"
import { settle } from "../bin/browser.mjs"
import { blank, copy, crop, frame, inks, label, savePng, shrink } from "./images.mjs"

const place = ["x", "y", "width", "height"]
const frameLook = ["border-radius", "box-shadow"]

export const regions = [
  { name: "decks sidebar", selector: "[data-decks-sidebar]" },
  { name: "decks main", selector: "[data-decks-main]" },
  { name: "decks header", selector: "[data-decks-header]" },
  { name: "settings header", selector: "[data-settings-header]" },
  { name: "settings content", selector: "[data-settings-content]" },
  { name: "editor sidebar", selector: "[data-editor-sidebar]" },
  { name: "sidebar head", selector: "[data-editor-sidebar] > :first-child" },
  {
    name: "slide item",
    selector: "[data-slide-item]",
    keys: ["x", "width", "height"],
    properties: ["border-radius", "padding", "gap"],
  },
  {
    name: "slide card",
    selector: "[data-slide-item] [data-slide-card]",
    keys: ["x", "width", "height"],
    properties: ["border-radius"],
  },
  { name: "canvas column", selector: "[data-editor-canvas]" },
  { name: "slide label", selector: "[data-slide-label]", properties: ["font-size", "color"] },
  { name: "slide", selector: "[data-slide-label] + *, [data-slide-paint]", properties: frameLook },
  { name: "toolbar", selector: "[data-editor-toolbar]", keys: ["y", "height"] },
  { name: "panel", selector: "[data-editor-panel]" },
  { name: "panel head", selector: "[data-editor-panel] > :first-child" },
  {
    name: "zoom readout",
    selector: "[data-editor-panel] > :first-child > :first-child",
    keys: ["x", "y", "height"],
    properties: [],
  },
  { name: "export button", selector: "[data-editor-panel] > :first-child > :last-child" },
].map((region) => ({ keys: place, ...region }))

export const properties = [
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "color",
  "background-color",
  "border",
  "border-radius",
  "padding",
  "gap",
  "box-shadow",
  "opacity",
]

export async function readRegions(page) {
  await settle(page)
  return page.evaluate(
    ({ regions, properties }) =>
      regions.flatMap(({ name, selector }) => {
        const element = [...document.querySelectorAll(selector)].find((each) =>
          each.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
        )
        if (element === undefined) return []
        const { x, y, width, height } = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        const round = (value) => Math.round(value * 10) / 10
        return [
          {
            name,
            selector,
            box: { x: round(x), y: round(y), width: round(width), height: round(height) },
            style: Object.fromEntries(properties.map((key) => [key, style.getPropertyValue(key)])),
          },
        ]
      }),
    { regions, properties },
  )
}

export function compareRegions(design, real, tolerance = 1) {
  const present = regions.filter((region) => [...design, ...real].some((row) => row.name === region.name))
  return present.map(({ name, keys, properties: looked = properties }, index) => {
    const left = design.find((row) => row.name === name)
    const right = real.find((row) => row.name === name)
    const number = index + 1
    const selector = (left ?? right).selector
    if (left === undefined) return { number, name, selector, status: "extra", real: right.box }
    if (right === undefined) return { number, name, selector, status: "missing", design: left.box }
    const delta = Object.fromEntries(keys.map((key) => [key, Math.round((right.box[key] - left.box[key]) * 10) / 10]))
    const styles = Object.fromEntries(
      looked
        .filter((key) => left.style[key] !== right.style[key])
        .map((key) => [key, { design: left.style[key], real: right.style[key] }]),
    )
    const moved = Object.values(delta).some((value) => Math.abs(value) > tolerance)
    const status = moved || Object.keys(styles).length > 0 ? "changed" : "match"
    return { number, name, selector, status, design: left.box, real: right.box, delta, styles }
  })
}

const statusInk = { match: inks.match, changed: inks[2], missing: inks[1], extra: inks[1] }

function outline(image, rows, side, scale) {
  for (const row of rows) {
    const box = row[side]
    if (box === undefined) continue
    const scaled = { x: box.x * scale, y: box.y * scale, width: box.width * scale, height: box.height * scale }
    frame(image, scaled, statusInk[row.status], row.status === "match" ? 1 : 2)
    if (row.status !== "match") label(image, String(row.number), scaled.x + 2, scaled.y + 2, statusInk[row.status], 2)
  }
}

export function sideBySide(designImage, realImage, rows, scale) {
  const factor = Math.max(1, Math.round(scale))
  const left = shrink(copy(designImage), factor)
  const right = shrink(copy(realImage), factor)
  outline(left, rows, "design", scale / factor)
  outline(right, rows, "real", scale / factor)
  const strip = 40
  const output = blank(left.width + strip + right.width, Math.max(left.height, right.height))
  PNG.bitblt(left, output, 0, 0, left.width, left.height, 0, 0)
  PNG.bitblt(right, output, 0, 0, right.width, right.height, left.width + strip, 0)
  const unit = scale / factor
  for (const [slot, row] of rows.filter((each) => each.status !== "match").entries()) {
    const boxes = [row.design, row.real].filter(Boolean)
    const top = Math.min(...boxes.map((box) => box.y)) * unit
    const bottom = Math.max(...boxes.map((box) => box.y + box.height)) * unit
    const x = left.width + 4 + (slot % 4) * 8
    for (let y = Math.max(0, Math.floor(top)); y < Math.min(output.height, Math.ceil(bottom)); y += 1)
      for (let dx = 0; dx < 5; dx += 1) output.data.set(statusInk[row.status], (y * output.width + x + dx) * 4)
  }
  return output
}

function pair(designImage, realImage, row, scale) {
  const boxes = [row.design, row.real].filter(Boolean)
  const union = {
    x: Math.min(...boxes.map((box) => box.x)),
    y: Math.min(...boxes.map((box) => box.y)),
    width: 0,
    height: 0,
  }
  union.width = Math.max(...boxes.map((box) => box.x + box.width)) - union.x
  union.height = Math.max(...boxes.map((box) => box.y + box.height)) - union.y
  const left = crop(designImage, union, scale)
  const right = crop(realImage, union, scale)
  const output = blank(left.width + 24 + right.width, Math.max(left.height, right.height))
  PNG.bitblt(left, output, 0, 0, left.width, left.height, 0, 0)
  PNG.bitblt(right, output, 0, 0, right.width, right.height, left.width + 24, 0)
  return output
}

export async function captureCompare(real, design, out) {
  mkdirSync(out, { recursive: true })
  const rows = compareRegions(await readRegions(design), await readRegions(real))
  const designImage = PNG.sync.read(
    await design.screenshot({ path: path.join(out, "design.png"), animations: "disabled" }),
  )
  const realImage = PNG.sync.read(await real.screenshot({ path: path.join(out, "real.png"), animations: "disabled" }))
  const scale = designImage.width / design.viewportSize().width
  const image = path.join(out, "compare.png")
  savePng(image, sideBySide(designImage, realImage, rows, scale))
  const differences = rows
    .filter((row) => row.status !== "match")
    .map((row) => {
      const file = path.join(out, `${String(row.number).padStart(2, "0")}-${row.name.replaceAll(" ", "-")}.png`)
      savePng(file, pair(designImage, realImage, row, scale))
      return { ...row, pair: file }
    })
  const report = {
    design: new URL(design.url()).pathname,
    real: new URL(real.url()).pathname,
    image,
    order:
      "design left, real right; green matches, orange changed, red missing or extra; the middle strip marks the rows a difference spans",
    regions: rows.length,
    matched: rows.filter((row) => row.status === "match").map((row) => row.name),
    differences,
    judges: "chrome geometry and style of the shared data-* regions only, never slide content, copy or sample counts",
  }
  const file = path.join(out, "compare.json")
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`)
  return {
    count: differences.length,
    regions: rows.length,
    ...(rows.length === 0 ? { note: "Neither page has a shared data-* region, so nothing was compared." } : {}),
    image,
    compare: file,
    designImage: path.join(out, "design.png"),
    report,
  }
}
