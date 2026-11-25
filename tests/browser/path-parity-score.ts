import { ink, markerColor, nearFullColor, polygonFill, wedgeColors } from "./path-parity-art.ts"

export type Picture = { readonly width: number; readonly height: number; readonly data: ArrayLike<number> }
export type Surface = "canvas" | "filmstrip" | "PDF"
type Rgb = readonly [number, number, number]
type Spot = readonly [number, number]

export const slideSize = { w: 1920, h: 1080 }
export type Pie = {
  readonly name: string
  readonly inner?: number
  readonly node?: number
  readonly nodes?: readonly number[]
  readonly ancestor?: number
}
export const pies: readonly Pie[] = [
  { name: "mixed opacity", nodes: [0.3, 0.45, 0.6, 0.75, 0.9] },
  { name: "highlighted slice", nodes: [0.5, 0.5, 1, 0.5, 0.5] },
  { name: "ring node 0.5", inner: 0.29, node: 0.5 },
  { name: "ring mixed opacity", inner: 0.29, nodes: [0.3, 0.45, 0.6, 0.75, 0.9] },
  { name: "ancestor 0.5", ancestor: 0.5 },
  { name: "ring ancestor 0.5", inner: 0.29, ancestor: 0.5 },
  { name: "node 0.9", node: 0.9 },
]
export const pieSize = 250
export const pieCorner = (index: number): Spot => [40 + index * 265, 30]
export const wedgeOpacity = (pie: Pie, index: number): number => pie.nodes?.[index] ?? pie.node ?? 1

export const sweepSize = 100
export const sweepDeltas = [0, 1e-9, 4e-9, 4e-8, 1.6e-7, 5e-7, 9e-7, 9.9e-7] as const
export type Sweep = {
  readonly corner: Spot
  readonly delta: number
  readonly direction: 1 | -1
  readonly ring: boolean
}
export const sweeps: readonly Sweep[] = [false, true].flatMap((ring) =>
  ([1, -1] as const).flatMap((direction) =>
    sweepDeltas.map((delta, i) => ({
      corner: [20 + (direction === 1 ? i : i + sweepDeltas.length) * 118, ring ? 780 : 650] as Spot,
      delta,
      direction,
      ring,
    })),
  ),
)
export const sweepStart = (direction: 1 | -1) => (direction === 1 ? 0.125 : 0.625)
export const ringInner = 0.29

export type Line = {
  readonly name: string
  readonly box: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  readonly points: readonly Spot[]
  readonly closed: boolean
  readonly dash: "solid" | "dash" | "dot"
  readonly weight: number
  readonly markers: boolean
}
const turns: readonly Spot[] = [
  [0, 0.8],
  [0.35, 0.2],
  [0.65, 0.65],
  [1, 0.1],
]
export const lines: readonly Line[] = [
  {
    name: "open polyline",
    box: { x: 40, y: 360, w: 560, h: 230 },
    points: turns,
    closed: false,
    dash: "solid",
    weight: 14,
    markers: true,
  },
  {
    name: "closed polyline",
    box: { x: 680, y: 360, w: 560, h: 230 },
    points: [
      [0.05, 0.85],
      [0.3, 0.1],
      [0.7, 0.35],
      [0.95, 0.9],
    ],
    closed: true,
    dash: "solid",
    weight: 14,
    markers: true,
  },
  {
    name: "dashed stroke",
    box: { x: 1320, y: 360, w: 560, h: 110 },
    points: [
      [0, 0.5],
      [1, 0.5],
    ],
    closed: false,
    dash: "dash",
    weight: 14,
    markers: false,
  },
  {
    name: "dotted stroke",
    box: { x: 1320, y: 500, w: 560, h: 110 },
    points: [
      [0, 0.5],
      [1, 0.5],
    ],
    closed: false,
    dash: "dot",
    weight: 14,
    markers: false,
  },
]
export const markerSize = 20
export const at = (line: Line, [x, y]: Spot): Spot => [line.box.x + x * line.box.w, line.box.y + y * line.box.h]

const parse = (hex: string): Rgb =>
  [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) as unknown as Rgb
const rgb = (picture: Picture, x: number, y: number): Rgb => {
  const column = Math.min(picture.width - 1, Math.max(0, Math.floor((x * picture.width) / slideSize.w)))
  const row = Math.min(picture.height - 1, Math.max(0, Math.floor((y * picture.height) / slideSize.h)))
  const index = (row * picture.width + column) * 4
  return [picture.data[index] ?? 0, picture.data[index + 1] ?? 0, picture.data[index + 2] ?? 0]
}

const over = (hex: string, alpha: number): Rgb =>
  parse(hex).map((value) => 255 * (1 - alpha) + value * alpha) as unknown as Rgb
const distance = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

function seamDistance(pixel: Rgb, left: Rgb, right: Rgb): number {
  const spread = right.map((value, i) => value - left[i]!)
  const along = spread.reduce((sum, value, i) => sum + value * (pixel[i]! - left[i]!), 0)
  const length = spread.reduce((sum, value) => sum + value ** 2, 0)
  const t = length === 0 ? 0 : Math.min(1, Math.max(0, along / length))
  return Math.hypot(...spread.map((value, i) => pixel[i]! - left[i]! - value * t))
}

export type Measure = {
  readonly seams: Readonly<Record<string, number>>
  readonly interiors: Readonly<Record<string, number>>
  readonly missing: readonly string[]
  readonly strokes: Readonly<Record<string, number>>
  readonly dashes: Readonly<Record<string, { readonly runs: number; readonly share: number }>>
}

const perUnit = (picture: Picture) => picture.width / slideSize.w

function pieSeam(picture: Picture, pie: Pie, index: number): number {
  const [x, y] = pieCorner(index)
  const radius = pieSize / 2
  const cx = x + radius
  const cy = y + radius
  const reach = Math.min(6, 0.2 * radius * perUnit(picture)) / perUnit(picture)
  const fractions = pie.inner === undefined ? [0.45, 0.65, 0.85] : [0.66, 0.78, 0.88]
  let worst = 0
  for (let i = 0; i < wedgeColors.length; i++) {
    const angle = (i * 2 * Math.PI) / wedgeColors.length
    for (const fraction of fractions) {
      const around = (offset: number) =>
        rgb(
          picture,
          cx + Math.cos(angle) * radius * fraction - Math.sin(angle) * offset,
          cy + Math.sin(angle) * radius * fraction + Math.cos(angle) * offset,
        )
      const left = around(-reach)
      const right = around(reach)
      for (let offset = -1.5; offset <= 1.5; offset += 0.5)
        worst = Math.max(worst, seamDistance(around(offset / perUnit(picture)), left, right))
    }
  }
  return worst
}

function pieInterior(picture: Picture, pie: Pie, index: number): number {
  const [x, y] = pieCorner(index)
  const radius = pieSize / 2
  const fraction = pie.inner === undefined ? 0.6 : 0.79
  let worst = 0
  wedgeColors.forEach((color, i) => {
    const angle = ((i + 0.5) * 2 * Math.PI) / wedgeColors.length
    const alpha = wedgeOpacity(pie, i) * (pie.ancestor ?? 1)
    const pixel = rgb(
      picture,
      x + radius + Math.cos(angle) * radius * fraction,
      y + radius + Math.sin(angle) * radius * fraction,
    )
    worst = Math.max(worst, distance(pixel, over(color, alpha)))
  })
  return worst
}

function missingSweeps(picture: Picture): readonly string[] {
  const wanted = parse(nearFullColor)
  return sweeps
    .filter(({ corner, ring }) =>
      Array.from({ length: 8 }, (_, i) => ((i + 0.5) / 8) * 2 * Math.PI).some((angle) =>
        (ring ? [0.395] : [0.1625, 0.4]).some((fraction) => {
          const pixel = rgb(
            picture,
            corner[0] + sweepSize / 2 + Math.cos(angle) * sweepSize * fraction,
            corner[1] + sweepSize / 2 + Math.sin(angle) * sweepSize * fraction,
          )
          return distance(pixel, wanted) > 12
        }),
      ),
    )
    .map(({ delta, direction, ring }) => `${ring ? "ring" : "disc"} ${String(delta)} (${String(direction)})`)
}

function nearest(picture: Picture, x: number, y: number, wanted: Rgb): number {
  const step = 1 / perUnit(picture)
  const found = [-1, 0, 1].flatMap((row) =>
    [-1, 0, 1].map((column) => distance(rgb(picture, x + column * step, y + row * step), wanted)),
  )
  return Math.min(...found)
}

function lineStrokes(picture: Picture, line: Line): number {
  const samples: [Spot, Rgb][] = []
  line.points.slice(0, -1).forEach((from, i) => {
    const to = line.points[i + 1]!
    const [x, y] = at(line, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2])
    samples.push([[x, y], parse(ink)])
  })
  if (line.closed) {
    const [first, last] = [line.points[0]!, line.points.at(-1)!]
    samples.push([at(line, [(first[0] + last[0]) / 2, (first[1] + last[1]) / 2]), parse(ink)])
    const centre: Spot = [
      line.points.reduce((sum, [x]) => sum + x, 0) / line.points.length,
      line.points.reduce((sum, [, y]) => sum + y, 0) / line.points.length,
    ]
    samples.push([at(line, centre), parse(polygonFill)])
  }
  if (line.markers)
    for (const point of line.points) {
      const [x, y] = at(line, point)
      samples.push([[x, y], parse(markerColor)])
    }
  return Math.max(...samples.map(([[x, y], wanted]) => nearest(picture, x, y, wanted)))
}

function dashRuns(picture: Picture, line: Line): { readonly runs: number; readonly share: number } {
  const [x0, y0] = at(line, line.points[0]!)
  const [x1, y1] = at(line, line.points[1]!)
  const steps = Math.floor(Math.hypot(x1 - x0, y1 - y0) * perUnit(picture) * 2)
  const wanted = parse(ink)
  let runs = 0
  let inked = 0
  let before = false
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const on = distance(rgb(picture, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t), wanted) < 120
    if (on) inked += 1
    if (on && !before) runs += 1
    before = on
  }
  return { runs, share: inked / (steps + 1) }
}

export function measure(picture: Picture): Measure {
  const seams: Record<string, number> = {}
  const interiors: Record<string, number> = {}
  pies.forEach((pie, index) => {
    seams[pie.name] = pieSeam(picture, pie, index)
    interiors[pie.name] = pieInterior(picture, pie, index)
  })
  const strokes: Record<string, number> = {}
  const dashes: Record<string, { runs: number; share: number }> = {}
  for (const line of lines) {
    if (line.dash === "solid") strokes[line.name] = lineStrokes(picture, line)
    else dashes[line.name] = dashRuns(picture, line)
  }
  return { seams, interiors, missing: missingSweeps(picture), strokes, dashes }
}

export type Difference = { readonly mean: number; readonly strong: number }

function resampled(canvas: Picture, width: number, height: number): Picture {
  const data = new Uint8Array(width * height * 4)
  for (let row = 0; row < height; row++) {
    const top = Math.floor((row * canvas.height) / height)
    const bottom = Math.max(top + 1, Math.floor(((row + 1) * canvas.height) / height))
    for (let column = 0; column < width; column++) {
      const left = Math.floor((column * canvas.width) / width)
      const right = Math.max(left + 1, Math.floor(((column + 1) * canvas.width) / width))
      const sum = [0, 0, 0]
      for (let y = top; y < bottom; y++)
        for (let x = left; x < right; x++)
          for (let channel = 0; channel < 3; channel++)
            sum[channel]! += canvas.data[(y * canvas.width + x) * 4 + channel] ?? 0
      const count = (bottom - top) * (right - left)
      for (let channel = 0; channel < 3; channel++) data[(row * width + column) * 4 + channel] = sum[channel]! / count
    }
  }
  return { width, height, data }
}

export const regions: Readonly<
  Record<string, { readonly x: number; readonly y: number; readonly w: number; readonly h: number }>
> = {
  ...Object.fromEntries(
    pies.map((pie, index) => [pie.name, { x: pieCorner(index)[0], y: pieCorner(index)[1], w: pieSize, h: pieSize }]),
  ),
  ...Object.fromEntries(lines.map((line) => [line.name, line.box])),
  "near-full discs": { x: 20, y: 650, w: 1870, h: sweepSize },
  "near-full rings": { x: 20, y: 780, w: 1870, h: sweepSize },
}

export function differences(picture: Picture, canvas: Picture): Readonly<Record<string, Difference>> {
  const base = resampled(canvas, picture.width, picture.height)
  return Object.fromEntries(
    Object.entries(regions).map(([name, box]) => {
      const scale = picture.width / slideSize.w
      const columns = [Math.floor(box.x * scale), Math.ceil((box.x + box.w) * scale)] as const
      const rows = [Math.floor(box.y * scale), Math.ceil((box.y + box.h) * scale)] as const
      let total = 0
      let strong = 0
      let count = 0
      for (let y = rows[0]; y < rows[1]; y++)
        for (let x = columns[0]; x < columns[1]; x++) {
          const index = (y * picture.width + x) * 4
          const gap = [0, 1, 2].map((channel) =>
            Math.abs((picture.data[index + channel] ?? 0) - (base.data[index + channel] ?? 0)),
          )
          total += (gap[0]! + gap[1]! + gap[2]!) / 3
          if (Math.max(...gap) > 64) strong += 1
          count += 1
        }
      return [name, { mean: total / count, strong: strong / count }]
    }),
  )
}

const seamLimit: Readonly<Record<Surface, number>> = { canvas: 5, PDF: 5, filmstrip: 32 }
const mixedSlack = 10
const interiorLimit = 6
const strokeLimit = 30
const shareSlack = 0.12
const differenceLimit: Readonly<Record<string, Difference>> = {
  pie: { mean: 3, strong: 0.02 },
  line: { mean: 4, strong: 0.05 },
  sweep: { mean: 8, strong: 0.1 },
}

const uniform = (name: string) => {
  const pie = pies.find((each) => each.name === name)
  return pie !== undefined && pie.nodes === undefined
}

const kindOf = (name: string) =>
  pies.some((pie) => pie.name === name) ? "pie" : name.startsWith("near-full") ? "sweep" : "line"

export function parityFaults(
  surface: Surface,
  found: Measure,
  canvas: Measure,
  difference?: Readonly<Record<string, Difference>>,
) {
  const faults: string[] = []
  const number = (value: number) => value.toFixed(1)
  for (const [name, score] of Object.entries(found.seams)) {
    const limit = uniform(name) ? seamLimit[surface] : (canvas.seams[name] ?? 0) + mixedSlack
    if (score > limit) faults.push(`${surface} ${name} seam ${number(score)} is over ${number(limit)}`)
  }
  for (const [name, error] of Object.entries(found.interiors))
    if (error > interiorLimit)
      faults.push(`${surface} ${name} colour is ${number(error)} from its mix of the wedge and the page`)
  for (const sweep of found.missing) faults.push(`${surface} near-full ${sweep} paints nothing`)
  for (const [name, gap] of Object.entries(found.strokes))
    if (gap > strokeLimit) faults.push(`${surface} ${name} is ${number(gap)} from its colour at a sample`)
  for (const [name, dashes] of Object.entries(found.dashes)) {
    const wanted = canvas.dashes[name]
    if (wanted === undefined) continue
    if (dashes.runs !== wanted.runs)
      faults.push(`${surface} ${name} has ${String(dashes.runs)} dashes, canvas has ${String(wanted.runs)}`)
    if (Math.abs(dashes.share - wanted.share) > shareSlack)
      faults.push(`${surface} ${name} inks ${dashes.share.toFixed(2)} of its length, canvas ${wanted.share.toFixed(2)}`)
  }
  for (const [name, gap] of Object.entries(difference ?? {})) {
    const limit = differenceLimit[kindOf(name)]!
    if (gap.mean > limit.mean || gap.strong > limit.strong)
      faults.push(
        `${surface} ${name} differs from the canvas by ${gap.mean.toFixed(2)} (${(gap.strong * 100).toFixed(1)}% far off)`,
      )
  }
  return faults
}
