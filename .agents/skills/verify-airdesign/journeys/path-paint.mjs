import { readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { PNG } from "pngjs"
import paths from "../../../../tests/browser/fixtures/paint-paths.json" with { type: "json" }
import { runPoppler } from "../bin/browser.mjs"
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
const center = (index) => (index === 20 ? [382, 243] : [190 + (index % 5) * 385, 125 + Math.floor(index / 5) * 235])

const paint = (color, opacity = 1) => ({ kind: "solid", color, opacity })
const seamCases = [
  ...Array.from({ length: 10 }, (_, i) => ({ name: `fan ${(i + 1) / 10}`, fan: true, node: (i + 1) / 10, limit: 4 })),
  ...Array.from({ length: 9 }, (_, i) => ({
    name: `wedge highlight at ${(i + 1) / 10}`,
    node: [1, ...Array(4).fill((i + 1) / 10)],
    limit: 4,
  })),
  { name: "ring varying alpha", inner: 0.25, fill: [0.1, 0.35, 0.8, 0.95, 1], limit: 8.5 },
  { name: "fan varying alpha", fan: true, node: [0.2, 0.9, 0.4, 1, 0.6], limit: 8.5 },
]

function pieces(cases) {
  return cases.flatMap((mode, index) => {
    const [x, y] = center(index)
    const pathsFor = mode.fan ? paths.triangles : mode.inner ? paths.thinHoleRings : paths.wedges
    return pathsFor.map((d, i) => ({
      mode,
      node: {
        id: `pie${index + 1}:${i + 1}`,
        props: {
          box: spot(x - pieSize / 2, y - pieSize / 2, pieSize, pieSize),
          geometry: { kind: "path", d, ...(mode.noStroke ? {} : { fillStroke: true }) },
          fills: [paint(colors[i], alphaAt(mode.fill, i))],
          opacity: alphaAt(mode.node, i),
        },
      },
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

const alphaAt = (alpha, i) => (Array.isArray(alpha) ? alpha[i] : alpha) ?? 1
const expectedPaint = (mode, i) => {
  const alpha = alphaAt(mode.node, i) * alphaAt(mode.fill, i) * (mode.ancestor ?? 1)
  return [1, 3, 5].map((at) => 255 * (1 - alpha) + Number.parseInt(colors[i].slice(at, at + 2), 16) * alpha)
}

function interiors(png, x, y) {
  return colors.map((_, i) => {
    const angle = ((i + 0.5) / colors.length) * 2 * Math.PI
    return rgb(png, x + 80 * Math.cos(angle), y + 80 * Math.sin(angle))
  })
}

function seamScore(png, x, y, mode, calibrate) {
  const paint = calibrate ? interiors(png, x, y) : undefined
  let worst = 0
  for (let i = 0; i < colors.length; i++) {
    const angle = (i * 2 * Math.PI) / colors.length
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    for (const r of mode.inner ? [65, 80, 95] : [30, 55, 80, 95]) {
      const at = (offset) => rgb(png, x + cos * r - sin * offset, y + sin * r + cos * offset)
      const before = paint?.[(i + colors.length - 1) % colors.length] ?? at(-6)
      const after = paint?.[i] ?? at(6)
      for (let offset = -1.5; offset <= 1.5; offset += 0.5) {
        worst = Math.max(worst, seamDistance(at(offset), before, after))
      }
    }
  }
  return worst
}

function checkPaint(kit, name, png, cases, grid, { seams = true, calibrate = false } = {}) {
  const scores = seams
    ? cases.map((mode, i) => ({
        name: mode.name,
        score: seamScore(png, ...center(i), mode, calibrate),
        limit: mode.limit,
      }))
    : []
  if (seams)
    kit.note(
      `${name} seams (worst RGB distance): ${scores.map(({ name, score }) => `${name} ${score.toFixed(1)}`).join(", ")}.`,
    )
  for (const [index, mode] of cases.entries()) {
    interiors(png, ...center(index)).forEach((pixel, i) => {
      const expected = expectedPaint(mode, i)
      kit.expect
        .soft(
          Math.hypot(...pixel.map((value, channel) => value - expected[channel])),
          `${name} ${mode.name} interior colour`,
        )
        .toBeLessThanOrEqual(4)
    })
  }
  const missing = grid.filter(({ x, y, inner }) =>
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

export default function drive(kit) {
  return drivePaths(kit, cases, sweepGrid)
}

export function driveSeams(kit) {
  return drivePaths(kit, seamCases, [], true)
}

async function captureActualSize({ page, context, expect }, slide) {
  const original = page.viewportSize()
  const size = { width: 2700, height: 1340 }
  await page.setViewportSize(size)
  await page.locator("[data-editor-stage]").focus()
  await page.keyboard.press("Shift+Digit0")
  await expect.poll(async () => (await slide.boundingBox())?.width).toBe(1920)

  const session = await context.newCDPSession(page)
  const images = []
  try {
    for (const scale of [1, 2]) {
      await session.send("Emulation.setDeviceMetricsOverride", { ...size, deviceScaleFactor: scale, mobile: false })
      const box = await slide.boundingBox()
      expect(box).not.toBeNull()
      const { data } = await session.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        clip: { ...box, scale: 1 },
      })
      const image = Buffer.from(data, "base64")
      expect(PNG.sync.read(image).width).toBe(1920 * scale)
      images.push(image)
    }
  } finally {
    await session.send("Emulation.clearDeviceMetricsOverride")
    await session.detach()
    if (original !== null) await page.setViewportSize(original)
    await page.keyboard.press("Shift+Digit1")
  }
  return images
}

async function drivePaths(kit, cases, grid, checkVector = false) {
  const { page, expect, note } = kit
  const ancestors = new Map()
  const nodes = pieces(cases).map(({ mode, node }) => {
    if (mode.ancestor === undefined) return node
    if (!ancestors.has(mode)) {
      ancestors.set(mode, {
        id: `translucent:${ancestors.size + 1}`,
        type: "frame",
        props: { box: spot(0, 0, 1920, 1080), opacity: mode.ancestor },
      })
    }
    return { ...node, parent: ancestors.get(mode).id }
  })
  nodes.push(
    ...grid.map(({ x, y, direction }, i) => ({
      id: `arc:${i + 1}`,
      props: {
        box: spot(x, y, sweepSize, sweepSize),
        geometry: { kind: "path", d: direction === 1 ? paths.positiveSweep : paths.negativeRing },
        fills: [paint(blue)],
      },
    })),
  )

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
  if (ancestors.size > 0) await landNodes(kit, opened, [...ancestors.values()])
  for (let i = 0; i < nodes.length; i += 30) await landNodes(kit, opened, nodes.slice(i, i + 30))
  const thumb = checkVector ? await page.locator("[data-slide-thumb]").first().screenshot() : undefined
  const slideBox = page.locator("[data-slide-box]")
  const [canvas, canvas2x] = checkVector ? await captureActualSize(kit, slideBox) : [await slideBox.screenshot()]
  const out = dirname(await kit.capture("path-paint"))
  await writeFile(join(out, "canvas.png"), canvas)
  if (canvas2x !== undefined) await writeFile(join(out, "canvas-2x.png"), canvas2x)
  if (thumb !== undefined) await writeFile(join(out, "filmstrip.png"), thumb)

  await page.getByRole("button", { name: productCopy.exportDeck, exact: true }).click()
  await page
    .getByRole("dialog", { name: exportCopy.title })
    .getByRole("button", { name: exportCopy.action, exact: true })
    .click()
  await expect(page.locator("[data-print-page]")).toHaveCount(1)
  const pdfPath = join(out, "slide.pdf")
  const raster = join(out, "pdf")
  await writeFile(pdfPath, await page.pdf({ preferCSSPageSize: true }))
  runPoppler("pdftoppm", ["-r", "144", "-png", "-singlefile", pdfPath, raster])
  if (checkVector)
    note("Seam scores reference sampled wedge interiors. Each interior also has an independent absolute RGB check.")
  const results = [
    ["Canvas", checkPaint(kit, "Canvas", PNG.sync.read(canvas), cases, grid, { calibrate: checkVector })],
    [
      "PDF",
      checkPaint(kit, "PDF", PNG.sync.read(await readFile(raster + ".png")), cases, grid, { calibrate: checkVector }),
    ],
  ]
  if (thumb !== undefined)
    results.push(["Filmstrip", checkPaint(kit, "Filmstrip", PNG.sync.read(thumb), cases, grid, { seams: false })])
  if (canvas2x !== undefined)
    results.push(["Canvas 2×", checkPaint(kit, "Canvas 2×", PNG.sync.read(canvas2x), cases, grid, { calibrate: true })])
  for (const [name, { scores, missing }] of results) {
    expect.soft(missing, `${name} near-full discs and rings`).toHaveLength(0)
    for (const { name: mode, score, limit } of scores) {
      const cap = checkVector && limit === 4 ? ({ Canvas: 3.2, "Canvas 2×": 4.2, PDF: 2.7 }[name] ?? limit) : limit
      expect.soft(score, `${name} ${mode} seam`).toBeLessThanOrEqual(cap)
    }
  }
  if (checkVector) {
    const images = runPoppler("pdfimages", ["-list", pdfPath], { encoding: "utf8" }).trimEnd().split("\n").slice(2)
    expect.soft(images, "PDF image objects").toHaveLength(0)
    const bytes = (await readFile(pdfPath)).length
    expect.soft(bytes, "vector PDF bytes").toBeLessThanOrEqual(65_000)
    note(
      `PDF contains ${images.length} images and is ${bytes} bytes. Filmstrip verifies wedge interiors. Thumbnail resampling prevents it from measuring seam quality.`,
    )

    const [cx, cy] = center(14)
    const dx = 55
    const rimY = cy - Math.sqrt((pieSize / 2) ** 2 - dx ** 2)
    const rim = join(out, "pdf-rim-400")
    runPoppler("pdftoppm", [
      "-r",
      "576",
      "-x",
      String((cx + dx) * 4 - 120),
      "-y",
      String(Math.floor(rimY * 4) - 16),
      "-W",
      "240",
      "-H",
      "96",
      "-png",
      "-singlefile",
      pdfPath,
      rim,
    ])
    const zoom = PNG.sync.read(await readFile(rim + ".png"))
    const greenAt = (y) => zoom.data[(y * zoom.width + 120) * 4 + 1]
    const interior = greenAt(zoom.height - 1)
    const threshold = (share) =>
      Array.from({ length: zoom.height }, (_, y) => y).find((y) => greenAt(y) <= 255 - (255 - interior) * share)
    expect(interior, "400% rim contrast").toBeLessThan(230)
    const edge = threshold(0.9) - threshold(0.1)
    expect.soft(edge, "400% rim transition in device pixels").toBeLessThanOrEqual(2)
    note(`At 400%, the rim reaches 90% of its interior colour across ${edge} device px from its 10% point.`)
  }
}
