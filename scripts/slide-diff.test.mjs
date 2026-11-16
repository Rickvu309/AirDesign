import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { PNG } from "pngjs"
import { scaleDown } from "./paint-fidelity.mjs"
import { heatmap, slideBar, slideDiff, slideDiffLines } from "./slide-diff.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const filled = (width, height, paint) => {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data.set([...paint(x, y), 255], (y * width + x) * 4)
    }
  }
  return { width, height, data }
}

const white = [255, 255, 255]
const black = [0, 0, 0]
const inside = (x, y, box) => x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height
const slideWith = (width, height, box) => filled(width, height, (x, y) => (inside(x, y, box) ? black : white))
const box = { x: 100, y: 100, width: 60, height: 40 }
const fixture = (name) =>
  PNG.sync.read(
    fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "paint-fidelity-fixtures", name)),
  )
const render = fixture("render.png")

const itself = slideDiff(render, render)
same(
  "an image against itself scores 1 and matches",
  [itself.score, itself.worst.score, itself.changed, itself.match],
  [1, 1, 0, true],
)
same("the size is the reference's size", [itself.width, itself.height], [render.width, render.height])

const full = slideWith(1920, 1080, box)
const missing = slideDiff(full, slideWith(1920, 1080, { x: 0, y: 0, width: 0, height: 0 }))
same(
  "one missing 60x40 dark box on a white slide fails on the worst tile though the mean stays above 0.97",
  [
    missing.score > slideBar.score,
    missing.worst.score < slideBar.worst,
    missing.match,
    missing.worst.size,
    missing.worst.x <= box.x + box.width && missing.worst.x + 32 > box.x,
    missing.worst.y <= box.y + box.height && missing.worst.y + 32 > box.y,
  ],
  [true, true, false, 32, true, true],
)
same("the changed share counts the missing box's pixels", Math.round(missing.changed * 1920 * 1080), 60 * 40)
same(
  "the line names the failing bar",
  slideDiffLines(missing, "out.png")[0].endsWith("match no (worst tile under 0.80)"),
  true,
)
same("a match line says yes", slideDiffLines(itself, null)[0].endsWith("match yes"), true)

const flat = (width, height) => slideWith(width, height, { x: 100, y: 100, width: 60, height: 40 })
const half = { width: 960, height: 540, data: new Uint8Array(960 * 540 * 4).fill(255) }
const scaled = scaleDown(flat(1920, 1080), { width: 960, height: 540 })
for (let at = 0; at < 960 * 540; at += 1) half.data.set(scaled.subarray(at * 3, at * 3 + 3), at * 4)
const halved = slideDiff(flat(1920, 1080), half)
same(
  "a painted image at half size is scaled to the reference before scoring",
  [halved.width, halved.height, halved.score, halved.changed, halved.match],
  [1920, 1080, 1, 0, true],
)

const marked = heatmap(full, slideWith(1920, 1080, { x: 0, y: 0, width: 0, height: 0 }))
const pixel = (image, x, y) => [...image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 3)]
const [red, green, blue] = pixel(marked, 130, 120)
const [far0, far1, far2] = pixel(marked, 1500, 900)
same(
  "the heatmap marks the changed window red",
  [marked.width, marked.height, red > green + 100, red > blue + 100, far0 === far1 && far1 === far2],
  [1920, 1080, true, true, true],
)

console.log("slide-diff tests passed")
