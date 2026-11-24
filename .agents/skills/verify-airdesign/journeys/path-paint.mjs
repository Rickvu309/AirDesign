import { execFileSync } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { PNG } from "pngjs"
import { packageBuild } from "../../../../scripts/package-build.mjs"
import { exportCopy, productCopy } from "../bin/product-copy.mjs"
import { clickSlide, landNodes, openDoomDeck, readDoom, spot } from "../look/doom-deck.mjs"

const colors = ["#d7263d", "#2e933c", "#1b98e0", "#f2c14e", "#8338ec"]
const blue = "#336699"
const pieSize = 220
const cases = [
  ...Array.from({ length: 10 }, (_, i) => {
    const opacity = (i + 1) / 10
    return { name: `node ${opacity}`, node: opacity, limit: 4 }
  }),
  { name: "ancestor 0.5", ancestor: 0.5, limit: 4 },
  { name: "fill 0.5", fill: 0.5, limit: 4 },
  { name: "agent fill 0.5", fill: 0.5, noStroke: true, limit: 20 },
  { name: "ring node 0.9", node: 0.9, inner: 0.25, limit: 4 },
  { name: "ring ancestor 0.5", ancestor: 0.5, inner: 0.25, limit: 4 },
]
const center = (index) => [190 + (index % 5) * 385, 125 + Math.floor(index / 5) * 235]

const paint = (color, opacity = 1) => ({ kind: "solid", color, opacity })
const wedge = (key, x, y, size, from, to, r0) => ({
  emit: {
    kind: "path",
    key: ["list", key],
    x,
    y,
    w: size,
    h: size,
    fill: blue,
    d: ["wedge", ["point", 0.5, 0.5], r0, 0.5, from, to],
  },
})

function pies() {
  return cases.flatMap((mode, index) => {
    const [x, y] = center(index)
    return colors.map((color, i) => ({
      ...wedge(`pie-${index}-${i}`, x - pieSize / 2, y - pieSize / 2, pieSize, i / 5, (i + 1) / 5, mode.inner ?? 0),
      color,
      mode,
    }))
  })
}

const sweepSize = 80
const sweepGrid = Array.from({ length: 80 }, (_, i) => {
  const x = 8 + (i % 20) * 96
  const y = 738 + Math.floor(i / 20) * 84
  const delta = (i % 40) * 4e-9
  const direction = i < 40 ? 1 : -1
  return { x, y, delta, direction, start: i < 40 ? 0.125 : 0.625, inner: i < 40 ? 0 : 0.29 }
})

function rgb(png, x, y) {
  const at = (Math.floor((y * png.height) / 1080) * png.width + Math.floor((x * png.width) / 1920)) * 4
  return Array.from(png.data.subarray(at, at + 3))
}

function seamDistance(pixel, left, right) {
  const spread = right.map((c, i) => c - left[i])
  const projection = spread.reduce((sum, c, i) => sum + c * (pixel[i] - left[i]), 0)
  const t = Math.min(1, Math.max(0, projection / spread.reduce((sum, c) => sum + c ** 2, 0)))
  return Math.hypot(...spread.map((c, i) => pixel[i] - left[i] - c * t))
}

function seamScore(png, x, y, inner) {
  let worst = 0
  for (let i = 0; i < colors.length; i++) {
    const angle = (i * 2 * Math.PI) / colors.length
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    for (const r of inner ? [65, 80, 95] : [30, 55, 80, 95]) {
      const at = (offset) => rgb(png, x + cos * r - sin * offset, y + sin * r + cos * offset)
      for (let offset = -1.5; offset <= 1.5; offset += 0.5) {
        worst = Math.max(worst, seamDistance(at(offset), at(-6), at(6)))
      }
    }
  }
  return worst
}

function checkPaint(kit, name, png) {
  const scores = cases.map(({ name, inner, limit }, i) => ({
    name,
    score: seamScore(png, ...center(i), inner),
    limit,
  }))
  kit.note(
    `${name} seams (worst RGB distance): ${scores.map(({ name, score }) => `${name} ${score.toFixed(1)}`).join(", ")}.`,
  )
  for (const [index, mode] of cases.entries()) {
    const [x, y] = center(index)
    const alpha = (mode.node ?? 1) * (mode.fill ?? 1) * (mode.ancestor ?? 1)
    colors.forEach((color, i) => {
      const angle = ((i + 0.5) * 2 * Math.PI) / colors.length
      const pixel = rgb(png, x + 80 * Math.cos(angle), y + 80 * Math.sin(angle))
      const expected = [1, 3, 5].map((at) => 255 * (1 - alpha) + Number.parseInt(color.slice(at, at + 2), 16) * alpha)
      kit.expect
        .soft(
          Math.hypot(...pixel.map((value, channel) => value - expected[channel])),
          `${name} ${mode.name} interior colour`,
        )
        .toBeLessThanOrEqual(4)
    })
  }
  const missing = sweepGrid.filter(({ x, y, inner }) =>
    Array.from({ length: 8 }, (_, i) => ((i + 0.5) / 8) * 2 * Math.PI).some((angle) =>
      (inner === 0 ? [13, 32] : [32]).some((r) => {
        const [red, green, blue] = rgb(png, x + 40 + r * Math.cos(angle), y + 40 + r * Math.sin(angle))
        return Math.hypot(red - 51, green - 102, blue - 153) > 12
      }),
    ),
  )
  kit.note(
    `${name} missing near-full wedges: ${missing.map(({ delta, direction }) => `${delta} (${direction})`).join(", ") || "none"}.`,
  )
  return { scores, missing }
}

export default async function drive(kit) {
  const { page, expect, repo, note } = kit
  const doom = await packageBuild(repo, "@airdesign/doom")
  const { expandComponent, readComponentSpec } = await packageBuild(repo, "@airdesign/doom", "component/index.js")
  const slices = pies()
  const parts = [
    ...slices,
    ...sweepGrid.map(({ x, y, start, delta, direction, inner }, i) =>
      wedge(`arc-${i}`, x, y, sweepSize, start, start + direction * (1 - delta), inner),
    ),
  ]
  const trees = Array.from({ length: Math.ceil(parts.length / 60) }, (_, i) => {
    const batch = parts.slice(i * 60, (i + 1) * 60)
    const spec = readComponentSpec({
      version: 1,
      name: "Path paint",
      collections: {},
      parts: batch.map(({ emit }) => ({ emit })),
    })
    expect(doom.isRefusal(spec), JSON.stringify(spec)).toBe(false)
    const tree = expandComponent(spec, {
      data: {},
      frame: { x: 0, y: 0, w: 1920, h: 1080 },
      theme: doom.defaultTheme,
      measure: doom.measureWith({}),
    })
    expect(doom.isRefusal(tree), JSON.stringify(tree)).toBe(false)
    return {
      ...tree,
      id: `paint${i}:1`,
      children: tree.children.map((child, j) => ({ ...child, id: `paint${i}:${j + 2}` })),
    }
  })
  const byKey = new Map(slices.map((slice) => [slice.emit.key[1], slice]))
  const ancestors = []
  const nodes = trees.flatMap((tree) => {
    const frames = new Map()
    return tree.children.map((child) => {
      const slice = byKey.get(child.key[0])
      if (!slice) return { ...child, parent: tree.id }
      const { mode, color } = slice
      if (mode.ancestor !== undefined && !frames.has(mode)) {
        const frame = {
          id: `translucent:${ancestors.length + 1}`,
          type: "frame",
          parent: tree.id,
          props: { box: spot(0, 0, 1920, 1080), opacity: mode.ancestor },
        }
        frames.set(mode, frame.id)
        ancestors.push(frame)
      }
      return {
        ...child,
        parent: frames.get(mode) ?? tree.id,
        props: {
          ...child.props,
          geometry: { ...child.props.geometry, ...(mode.noStroke ? {} : { fillStroke: true }) },
          fills: [paint(color, mode.fill)],
          opacity: mode.node ?? 1,
        },
      }
    })
  })

  await page.addInitScript(() => {
    window.print = () => {}
  })
  const opened = await openDoomDeck(kit)
  await clickSlide(page, 50, 50)
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Delete")
  await expect
    .poll(async () =>
      Object.values((await readDoom(kit, opened)).fold.nodes).filter((node) => node.parent?.id === opened.slide),
    )
    .toHaveLength(0)
  await landNodes(kit, opened, [...trees, ...ancestors])
  for (let i = 0; i < nodes.length; i += 30) await landNodes(kit, opened, nodes.slice(i, i + 30))
  const canvas = await page.locator("[data-slide-box]").screenshot()
  const out = dirname(await kit.capture("path-paint"))
  await writeFile(join(out, "canvas.png"), canvas)

  await page.getByRole("button", { name: productCopy.exportDeck, exact: true }).click()
  await page
    .getByRole("dialog", { name: exportCopy.title })
    .getByRole("button", { name: exportCopy.action, exact: true })
    .click()
  await expect(page.locator("[data-print-page]")).toHaveCount(1)
  const pdfPath = join(out, "slide.pdf")
  const raster = join(out, "pdf")
  await writeFile(pdfPath, await page.pdf({ preferCSSPageSize: true }))
  execFileSync("pdftoppm", ["-r", "144", "-png", "-singlefile", pdfPath, raster])
  const results = [
    ["Canvas", checkPaint(kit, "Canvas", PNG.sync.read(canvas))],
    ["PDF", checkPaint(kit, "PDF", PNG.sync.read(await readFile(raster + ".png")))],
  ]
  for (const [name, { scores, missing }] of results) {
    expect.soft(missing, `${name} near-full discs and rings`).toHaveLength(0)
    for (const { name: mode, score, limit } of scores) {
      expect.soft(score, `${name} ${mode} seam`).toBeLessThanOrEqual(limit)
    }
  }
  note("The same near-full grid and opacity cases were read from the slide canvas and the rasterized PDF.")
}
