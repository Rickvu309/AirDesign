export type Arrival = "made" | "changed" | "slide"

const svgSpace = "http://www.w3.org/2000/svg"
const inOut = "cubic-bezier(0.77, 0, 0.175, 1)"
const out = "cubic-bezier(0.22, 1, 0.36, 1)"
const sweepCurve = "cubic-bezier(0.4, 0, 0.2, 1)"
const glow = 24

export const traceSpark = {
  stagger: 80,
  staggerCap: 480,
  outline: { made: 520, changed: 380, slide: 900, fadeAt: 640, slideFadeAt: 980, fade: 380 },
  slideInset: 2,
  focus: { at: 300, duration: 420, blur: 18 },
  sweep: { at: 380, duration: 560 },
  sparks: { at: 420 },
  textPad: 5,
} as const

type Box = { readonly left: number; readonly top: number; readonly width: number; readonly height: number }

const frac = (value: number) => value - Math.floor(value)

function ownedBy(element: HTMLElement, selector: string): HTMLElement[] {
  return [...element.querySelectorAll<HTMLElement>(selector)].filter((each) => each.closest("[data-node]") === element)
}

function paintedBox(element: HTMLElement): DOMRect {
  const lines = ownedBy(element, "[data-line]")
  if (lines.length === 0 || ownedBy(element, "[data-body]").length > 0) return element.getBoundingClientRect()
  const range = document.createRange()
  const rects = lines.flatMap((line) => {
    range.selectNodeContents(line)
    const rect = range.getBoundingClientRect()
    return rect.width > 0 ? [rect] : []
  })
  if (rects.length === 0) return element.getBoundingClientRect()
  const left = Math.min(...rects.map((each) => each.left)) - traceSpark.textPad
  const top = Math.min(...rects.map((each) => each.top)) - traceSpark.textPad
  const right = Math.max(...rects.map((each) => each.right)) + traceSpark.textPad
  const bottom = Math.max(...rects.map((each) => each.bottom)) + traceSpark.textPad
  return new DOMRect(left, top, right - left, bottom - top)
}

function placed(layer: HTMLElement, rect: DOMRect): Box {
  const origin = layer.getBoundingClientRect()
  return { left: rect.left - origin.left, top: rect.top - origin.top, width: rect.width, height: rect.height }
}

function outlineOf(box: Box, round: boolean): SVGSVGElement {
  const svg = document.createElementNS(svgSpace, "svg")
  svg.setAttribute("width", String(box.width + 2 * glow))
  svg.setAttribute("height", String(box.height + 2 * glow))
  svg.style.cssText = `position:absolute;left:${box.left - glow}px;top:${box.top - glow}px;overflow:visible;filter:drop-shadow(0 0 5px var(--arrival-trace))`
  const line = document.createElementNS(svgSpace, round ? "ellipse" : "rect")
  const sizes: Record<string, number> = round
    ? { cx: glow + box.width / 2, cy: glow + box.height / 2, rx: box.width / 2, ry: box.height / 2 }
    : { x: glow, y: glow, width: box.width, height: Math.max(box.height, 1), rx: Math.min(5, box.height / 2) }
  for (const [name, value] of Object.entries(sizes)) line.setAttribute(name, String(value))
  for (const [name, value] of Object.entries({
    fill: "none",
    stroke: "var(--arrival-trace)",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    pathLength: "1",
    "stroke-dasharray": "1",
  }))
    line.setAttribute(name, value)
  svg.append(line)
  return svg
}

function sweepOf(box: Box, round: boolean): { readonly clip: HTMLElement; readonly bar: HTMLElement } {
  const clip = document.createElement("div")
  clip.style.cssText = `position:absolute;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;overflow:hidden;border-radius:${round ? "50%" : "3px"}`
  const bar = document.createElement("div")
  bar.style.cssText = `position:absolute;inset-block:0;left:0;width:${Math.max(80, box.width * 0.5)}px;background:linear-gradient(90deg,transparent,var(--arrival-sweep),transparent)`
  clip.append(bar)
  return { clip, bar }
}

function sparksOf(
  box: Box,
  seed: number,
  at: number,
): { readonly spark: HTMLElement; readonly play: () => Animation }[] {
  const count = Math.min(6, Math.max(4, Math.round((box.width + box.height) / 120)))
  return Array.from({ length: count }, (_, index) => {
    const turn = (index / count) * Math.PI * 2 + 0.6 * frac(index * 0.618 + seed)
    const reach = 1 / Math.max(Math.abs(Math.cos(turn)), Math.abs(Math.sin(turn)))
    const x = box.left + box.width / 2 + (Math.cos(turn) * reach * box.width) / 2
    const y = box.top + box.height / 2 + (Math.sin(turn) * reach * box.height) / 2
    const size = 2 + frac(index * 0.39 + seed)
    const far = 8 + 8 * frac(index * 0.73 + seed)
    const dx = Math.cos(turn) * far
    const dy = Math.sin(turn) * far - 4
    const spark = document.createElement("div")
    spark.style.cssText = `position:absolute;left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;border-radius:50%;background:var(--arrival-spark);box-shadow:0 0 6px 1px var(--arrival-spark-glow)`
    const play = () =>
      spark.animate(
        [
          { opacity: 0, transform: "translate(0px, 0px) scale(0.4)" },
          { opacity: 1, transform: `translate(${dx * 0.25}px, ${dy * 0.25}px) scale(1)`, offset: 0.25 },
          { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(0.3)` },
        ],
        {
          duration: 500 + 300 * frac(index * 0.51 + seed),
          delay: at + 120 * frac(index * 0.29 + seed),
          easing: out,
          fill: "both",
        },
      )
    return { spark, play }
  })
}

export type Playing = { readonly stop: () => void; readonly ended: Promise<void> }

export function playArrival(layer: HTMLElement, element: HTMLElement, arrival: Arrival, order: number): Playing {
  const delay = Math.min(order * traceSpark.stagger, traceSpark.staggerCap)
  const round = element.dataset.geometry === "ellipse"
  const whole = placed(layer, paintedBox(element))
  const inset = arrival === "slide" ? traceSpark.slideInset : 0
  const box = {
    left: whole.left + inset,
    top: whole.top + inset,
    width: whole.width - 2 * inset,
    height: whole.height - 2 * inset,
  }
  const group = document.createElement("div")
  const outline = outlineOf(box, round)
  const sweep = sweepOf(box, round)
  group.append(outline, sweep.clip)
  const marks: Animation[] = []
  const { opacity, filter } = getComputedStyle(element)
  const rest = filter === "none" ? "" : ` ${filter}`
  const focus =
    arrival === "made"
      ? element.animate(
          [
            { opacity: 0, filter: `blur(${traceSpark.focus.blur}px)${rest}` },
            { opacity, filter: `blur(0px)${rest}` },
          ],
          { duration: traceSpark.focus.duration, delay: delay + traceSpark.focus.at, easing: out, fill: "backwards" },
        )
      : null
  const sparks = arrival === "made" ? sparksOf(box, order * 0.37, delay + traceSpark.sparks.at) : []
  group.append(...sparks.map((each) => each.spark))
  layer.append(group)
  marks.push(
    outline.firstElementChild!.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: traceSpark.outline[arrival],
      delay,
      easing: inOut,
      fill: "both",
    }),
    outline.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: traceSpark.outline.fade,
      delay: delay + (arrival === "slide" ? traceSpark.outline.slideFadeAt : traceSpark.outline.fadeAt),
      easing: "ease",
      fill: "both",
    }),
    sweep.bar.animate([{ transform: "translateX(-100%)" }, { transform: `translateX(${box.width}px)` }], {
      duration: traceSpark.sweep.duration,
      delay: delay + traceSpark.sweep.at,
      easing: sweepCurve,
      fill: "both",
    }),
    ...sparks.map((each) => each.play()),
  )
  const stop = () => {
    focus?.cancel()
    for (const mark of marks) mark.cancel()
    group.remove()
  }
  const ended = Promise.all(marks.map((mark) => mark.finished)).then(stop, stop)
  return { stop, ended }
}
