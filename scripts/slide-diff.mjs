import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { PNG } from "pngjs"
import { scaleDown } from "./paint-fidelity.mjs"

const self = fileURLToPath(import.meta.url)
const usage = "node scripts/slide-diff.mjs reference.png painted.png [--heatmap out.png] [--json]"

export const slideBar = { score: 0.97, worst: 0.8, tolerance: 24 }

const windowSize = 8
const windowStride = 4
const tileSize = 32
const faintest = 0.5
const fade = 0.4
const first = (0.01 * 255) ** 2
const second = (0.03 * 255) ** 2

const luminance = (rgb, count) => {
  const light = new Float32Array(count)
  for (let at = 0; at < count; at += 1) {
    light[at] = 0.2126 * rgb[at * 3] + 0.7152 * rgb[at * 3 + 1] + 0.0722 * rgb[at * 3 + 2]
  }
  return light
}

const windowScore = (left, right, width, x, y) => {
  let leftSum = 0
  let rightSum = 0
  let leftSquares = 0
  let rightSquares = 0
  let products = 0
  for (let row = y; row < y + windowSize; row += 1) {
    for (let column = x; column < x + windowSize; column += 1) {
      const a = left[row * width + column]
      const b = right[row * width + column]
      leftSum += a
      rightSum += b
      leftSquares += a * a
      rightSquares += b * b
      products += a * b
    }
  }
  const count = windowSize * windowSize
  const leftMean = leftSum / count
  const rightMean = rightSum / count
  const leftVariance = leftSquares / count - leftMean * leftMean
  const rightVariance = rightSquares / count - rightMean * rightMean
  const covariance = products / count - leftMean * rightMean
  return (
    ((2 * leftMean * rightMean + first) * (2 * covariance + second)) /
    ((leftMean * leftMean + rightMean * rightMean + first) * (leftVariance + rightVariance + second))
  )
}

const compared = (reference, painted) => {
  const { width, height } = reference
  if (width < windowSize || height < windowSize) throw new Error(`The reference is ${width}x${height}, under 8x8.`)
  const size = { width, height }
  const left = scaleDown(reference, size)
  const right = scaleDown(painted, size)
  const lightLeft = luminance(left, width * height)
  const lightRight = luminance(right, width * height)
  const windows = []
  for (let y = 0; y + windowSize <= height; y += windowStride) {
    for (let x = 0; x + windowSize <= width; x += windowStride) {
      windows.push({ x, y, score: windowScore(lightLeft, lightRight, width, x, y) })
    }
  }
  return { width, height, left, right, windows }
}

const worstTile = (windows, width) => {
  const tiles = new Map()
  for (const item of windows) {
    const key = Math.floor(item.y / tileSize) * width + Math.floor(item.x / tileSize)
    const tile = tiles.get(key) ?? {
      x: Math.floor(item.x / tileSize) * tileSize,
      y: Math.floor(item.y / tileSize) * tileSize,
      sum: 0,
      count: 0,
    }
    tile.sum += item.score
    tile.count += 1
    tiles.set(key, tile)
  }
  let worst = null
  for (const tile of tiles.values()) {
    const score = tile.sum / tile.count
    if (worst === null || score < worst.score) worst = { score, x: tile.x, y: tile.y, size: tileSize }
  }
  return worst
}

const changedShare = (left, right, tolerance) => {
  let changed = 0
  const count = left.length / 3
  for (let at = 0; at < count; at += 1) {
    const difference = Math.max(
      Math.abs(left[at * 3] - right[at * 3]),
      Math.abs(left[at * 3 + 1] - right[at * 3 + 1]),
      Math.abs(left[at * 3 + 2] - right[at * 3 + 2]),
    )
    if (difference > tolerance) changed += 1
  }
  return changed / count
}

export const slideDiff = (reference, painted, bar = slideBar) => {
  const { width, height, left, right, windows } = compared(reference, painted)
  const score = windows.reduce((sum, item) => sum + item.score, 0) / windows.length
  const worst = worstTile(windows, width)
  return {
    width,
    height,
    score,
    worst,
    changed: changedShare(left, right, bar.tolerance),
    match: score >= bar.score && worst.score >= bar.worst,
  }
}

export const heatmap = (reference, painted) => {
  const { width, height, left, windows } = compared(reference, painted)
  const lowest = new Float32Array(width * height).fill(1)
  for (const item of windows) {
    for (let row = item.y; row < item.y + windowSize; row += 1) {
      for (let column = item.x; column < item.x + windowSize; column += 1) {
        const at = row * width + column
        if (item.score < lowest[at]) lowest[at] = item.score
      }
    }
  }
  const data = new Uint8Array(width * height * 4)
  for (let at = 0; at < width * height; at += 1) {
    const grey = 0.2126 * left[at * 3] + 0.7152 * left[at * 3 + 1] + 0.0722 * left[at * 3 + 2]
    const pale = 255 - fade * (255 - grey)
    const heat = Math.min(1, Math.max(0, (1 - lowest[at]) / (1 - faintest)))
    data[at * 4] = Math.round(pale + heat * (255 - pale))
    data[at * 4 + 1] = Math.round(pale * (1 - heat))
    data[at * 4 + 2] = Math.round(pale * (1 - heat))
    data[at * 4 + 3] = 255
  }
  const worst = worstTile(windows, width)
  const right = Math.min(width, worst.x + worst.size)
  const bottom = Math.min(height, worst.y + worst.size)
  for (let y = worst.y; y < bottom; y += 1) {
    for (let x = worst.x; x < right; x += 1) {
      if (x - worst.x < 2 || right - x <= 2 || y - worst.y < 2 || bottom - y <= 2)
        data.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 3)
    }
  }
  return { width, height, data }
}

const failures = (result, bar) => [
  ...(result.score < bar.score ? [`score under ${bar.score.toFixed(2)}`] : []),
  ...(result.worst.score < bar.worst ? [`worst tile under ${bar.worst.toFixed(2)}`] : []),
]

export const slideDiffLines = (result, heatmapFile, bar = slideBar) => {
  const reasons = failures(result, bar)
  return [
    `slide-diff ${result.width}x${result.height}: score ${result.score.toFixed(3)}, worst tile ${result.worst.score.toFixed(3)} at ${result.worst.x},${result.worst.y}, changed ${(result.changed * 100).toFixed(1)} % (tolerance ${bar.tolerance}), match ${reasons.length === 0 ? "yes" : `no (${reasons.join(", ")})`}`,
    ...(heatmapFile === null ? [] : [`heatmap: ${heatmapFile}`]),
  ]
}

export const slideDiffArgs = (argv) => {
  const files = []
  let heatmapFile = null
  let json = false
  for (let index = 0; index < argv.length; index += 1) {
    const word = argv[index]
    if (word === "--json") json = true
    else if (word === "--heatmap") {
      heatmapFile = argv[index + 1]
      if (heatmapFile === undefined) throw new Error(`--heatmap needs a file. Usage: ${usage}`)
      index += 1
    } else if (word.startsWith("--")) throw new Error(`Unknown flag ${word}. Usage: ${usage}`)
    else files.push(word)
  }
  if (files.length !== 2) throw new Error(`Give two images. Usage: ${usage}`)
  return { reference: files[0], painted: files[1], heatmapFile, json }
}

const main = () => {
  const args = slideDiffArgs(process.argv.slice(2))
  const read = (file) => PNG.sync.read(fs.readFileSync(file))
  const reference = read(args.reference)
  const painted = read(args.painted)
  const result = slideDiff(reference, painted)
  if (args.heatmapFile !== null) {
    const image = heatmap(reference, painted)
    const png = new PNG({ width: image.width, height: image.height })
    png.data = Buffer.from(image.data)
    fs.writeFileSync(args.heatmapFile, PNG.sync.write(png))
  }
  process.stdout.write(
    args.json
      ? `${JSON.stringify({ ...result, heatmap: args.heatmapFile }, null, 2)}\n`
      : `${slideDiffLines(result, args.heatmapFile).join("\n")}\n`,
  )
  process.exitCode = result.match ? 0 : 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 2
  }
}
