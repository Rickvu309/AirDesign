import { writeFileSync } from "node:fs"
import { PNG } from "pngjs"

const digits = [
  "111101101101111",
  "010110010010111",
  "111001111100111",
  "111001111001111",
  "101101111001001",
  "111100111001111",
  "111100111101111",
  "111001010010010",
  "111101111101111",
  "111101111001111",
]

export const inks = {
  1: [210, 36, 55, 255],
  2: [222, 120, 0, 255],
  3: [45, 111, 205, 255],
  match: [24, 150, 80, 255],
  white: [255, 255, 255, 255],
}

export function blank(width, height) {
  const image = new PNG({ width, height })
  image.data.fill(255)
  return image
}

function dot(image, x, y, color) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return
  image.data.set(color, (Math.floor(y) * image.width + Math.floor(x)) * 4)
}

export function frame(image, box, color, thickness) {
  const left = Math.max(0, Math.floor(box.x))
  const top = Math.max(0, Math.floor(box.y))
  const right = Math.min(image.width - 1, Math.ceil(box.x + box.width))
  const bottom = Math.min(image.height - 1, Math.ceil(box.y + box.height))
  for (let line = 0; line < thickness; line += 1) {
    for (let x = left; x <= right; x += 1) {
      dot(image, x, top + line, color)
      dot(image, x, bottom - line, color)
    }
    for (let y = top; y <= bottom; y += 1) {
      dot(image, left + line, y, color)
      dot(image, right - line, y, color)
    }
  }
}

export function label(image, text, x, y, color, size) {
  const width = (text.length * 4 + 2) * size
  const height = 7 * size
  const left = Math.max(0, Math.min(image.width - width, Math.floor(x)))
  const top = Math.max(0, Math.min(image.height - height, Math.floor(y)))
  for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) dot(image, left + dx, top + dy, color)
  for (const [index, digit] of [...text].entries()) {
    for (let at = 0; at < 15; at += 1) {
      if (digits[Number(digit)][at] !== "1") continue
      const cx = left + (index * 4 + 1 + (at % 3)) * size
      const cy = top + (1 + Math.floor(at / 3)) * size
      for (let dy = 0; dy < size; dy += 1) for (let dx = 0; dx < size; dx += 1) dot(image, cx + dx, cy + dy, inks.white)
    }
  }
  return { width, height }
}

export function copy(image) {
  return PNG.sync.read(PNG.sync.write(image))
}

export function crop(image, box, scale, padding = 16) {
  const x = Math.max(0, Math.floor((box.x - padding) * scale))
  const y = Math.max(0, Math.floor((box.y - padding) * scale))
  const width = Math.max(1, Math.min(image.width - x, Math.ceil((box.width + padding * 2) * scale)))
  const height = Math.max(1, Math.min(image.height - y, Math.ceil((box.height + padding * 2) * scale)))
  const output = new PNG({ width, height })
  PNG.bitblt(image, output, x, y, width, height, 0, 0)
  return output
}

export function annotated(image, findings, scale) {
  const output = copy(image)
  for (const finding of [...findings].reverse()) {
    const box = {
      x: finding.box.x * scale,
      y: finding.box.y * scale,
      width: finding.box.width * scale,
      height: finding.box.height * scale,
    }
    const color = inks[finding.rank] ?? inks[3]
    frame(output, box, color, Math.max(2, scale))
    const size = Math.max(2, scale + 1)
    const above = box.y - 7 * size - 1
    label(output, String(finding.number), box.x, above >= 0 ? above : box.y + box.height + 1, color, size)
  }
  return output
}

export function shrink(image, factor) {
  if (factor === 1) return image
  const width = Math.floor(image.width / factor)
  const height = Math.floor(image.height / factor)
  const output = new PNG({ width, height })
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sum = [0, 0, 0, 0]
      for (let dy = 0; dy < factor; dy += 1)
        for (let dx = 0; dx < factor; dx += 1) {
          const at = ((y * factor + dy) * image.width + (x * factor + dx)) * 4
          for (let channel = 0; channel < 4; channel += 1) sum[channel] += image.data[at + channel]
        }
      const to = (y * width + x) * 4
      for (let channel = 0; channel < 4; channel += 1)
        output.data[to + channel] = Math.round(sum[channel] / factor ** 2)
    }
  }
  return output
}

export function savePng(file, image) {
  writeFileSync(file, PNG.sync.write(image))
}
