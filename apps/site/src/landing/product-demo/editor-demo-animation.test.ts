import { readFile } from "node:fs/promises"
import { afterEach, describe, expect, it, vi } from "vitest"
import { playEditorDemoAnimation } from "./editor-demo-animation"

type JsdomModule = {
  JSDOM: new (html: string) => { readonly window: Window & typeof globalThis }
}

interface RecordedAnimation {
  element: Element
  keyframes: Keyframe[]
  durationMs: number
  currentTime: number
  playing: boolean
  pause(): void
  play(): void
}

interface Change {
  startMs: number
  endMs: number
  from: string
  to: string
  easing: string | undefined
}

const posterMs = 13250
const travelCurve = "cubic-bezier(0.45, 0, 0.1, 1)"
const movingProperties = ["opacity", "transform", "clipPath"]

afterEach(() => {
  vi.unstubAllGlobals()
})

async function demoFixture(reducedMotion: boolean) {
  const jsdomName = "jsdom"
  const { JSDOM } = (await import(jsdomName)) as JsdomModule
  const markup = await readFile(new URL("./editor-demo-art.html", import.meta.url), "utf8")
  const tokens = await readFile(new URL("../../../../../packages/theme/src/tokens.css", import.meta.url), "utf8")
  const easeTokens = new Map(
    Array.from(tokens.matchAll(/(--ease-[a-z]+): ([^;]+);/g), ([, name, value]): [string, string] => [name, value]),
  )
  const dom = new JSDOM(`<div data-editor-demo>${markup}</div>`)
  const { document } = dom.window
  const demo = document.querySelector("[data-editor-demo]")
  if (!demo) throw new Error("fixture")
  const staticMarkup = demo.innerHTML
  const recorded: RecordedAnimation[] = []
  Object.defineProperty(dom.window.Element.prototype, "animate", {
    value(this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
      const animation: RecordedAnimation = {
        element: this,
        keyframes,
        durationMs: Number(options.duration),
        currentTime: 0,
        playing: true,
        pause: () => {
          animation.playing = false
        },
        play: () => {
          animation.playing = true
        },
      }
      recorded.push(animation)
      return animation
    },
  })
  Object.defineProperty(document, "fonts", { value: { ready: Promise.resolve() } })
  let report: (entries: { isIntersecting: boolean }[]) => void = () => {}
  vi.stubGlobal("document", document)
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reducedMotion && query === "(prefers-reduced-motion: reduce)",
  }))
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: (name: string) => easeTokens.get(name) ?? "" }))
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        report = callback
      }
      observe() {}
    },
  )
  await playEditorDemoAnimation(demo)
  const loopMs = Math.max(0, ...recorded.map((animation) => animation.durationMs))
  const loop = recorded.filter((animation) => animation.durationMs === loopMs)
  const animationOf = (selector: string, property: string) => {
    const found = loop.find(
      (animation) =>
        animation.element.matches(selector) && animation.keyframes.some((frame) => frame[property] !== undefined),
    )
    if (!found) throw new Error(`no ${property} animation on ${selector}`)
    return found
  }
  const partChanges = (part: string, property: string) =>
    changes(animationOf(`[data-demo-part="${part}"]`, property), property)
  return {
    demo,
    staticMarkup,
    recorded,
    loopMs,
    loop,
    animationOf,
    partChanges,
    show: (inView: boolean) => report([{ isIntersecting: inView }]),
  }
}

function atMs(animation: RecordedAnimation, frame: Keyframe): number {
  return Math.round(Number(frame.offset) * animation.durationMs)
}

function changes(animation: RecordedAnimation, property: string): Change[] {
  const frames = animation.keyframes.filter((frame) => frame[property] !== undefined)
  return frames.slice(1).flatMap((frame, index) => {
    const before = frames[index]
    const from = String(before[property])
    const to = String(frame[property])
    return from === to
      ? []
      : [{ startMs: atMs(animation, before), endMs: atMs(animation, frame), from, to, easing: before.easing }]
  })
}

function settledValue(animation: RecordedAnimation, property: string, ms: number): string | undefined {
  const frames = animation.keyframes.filter((frame) => frame[property] !== undefined)
  const before = frames.filter((frame) => atMs(animation, frame) <= ms).at(-1)
  const after = frames.find((frame) => atMs(animation, frame) >= ms)
  if (!before || !after) return undefined
  return String(before[property]) === String(after[property]) ? String(before[property]) : undefined
}

function lastChangeTo(found: Change[], to: string): Change {
  const change = found.filter((candidate) => candidate.to === to).at(-1)
  if (!change) throw new Error(`no change to ${to}`)
  return change
}

describe("playEditorDemoAnimation", () => {
  it("builds no animation and leaves the finished deck as it is under reduced motion", async () => {
    const { demo, recorded, staticMarkup } = await demoFixture(true)
    expect(recorded).toEqual([])
    expect(demo.innerHTML).toBe(staticMarkup)
  })

  it("starts paused on the finished deck, so a visitor never sees it snap to blank", async () => {
    const { loop } = await demoFixture(false)
    expect(loop.length).toBeGreaterThan(0)
    for (const animation of loop) {
      expect(animation.playing).toBe(false)
      expect(animation.currentTime).toBe(posterMs)
      for (const property of movingProperties) {
        if (animation.keyframes.some((frame) => frame[property] !== undefined)) {
          expect(settledValue(animation, property, posterMs)).toBeDefined()
        }
      }
    }
    const drawn = loop.filter(
      (animation) =>
        animation.element.getAttributeNames().some((name) => name.startsWith("data-demo-")) &&
        animation.keyframes.some((frame) => frame.opacity !== undefined),
    )
    expect(drawn.length).toBeGreaterThan(60)
    for (const animation of drawn) {
      if (animation.element.parentElement?.closest('[style*="opacity: 0"]')) continue
      const staticOpacity = (animation.element as HTMLElement).style.opacity || "1"
      expect(Number(settledValue(animation, "opacity", posterMs)), animation.element.outerHTML.slice(0, 200)).toBe(
        Number(staticOpacity),
      )
    }
  })

  it("loops in 16 s and holds the finished deck about 2 s before the reset", async () => {
    const { loop, loopMs } = await demoFixture(false)
    expect(loopMs).toBe(16000)
    const afterPoster = loop.flatMap((animation) =>
      movingProperties.flatMap((property) => changes(animation, property)).filter((change) => change.endMs > posterMs),
    )
    const holdMs = Math.min(...afterPoster.map((change) => change.startMs)) - posterMs
    expect(holdMs).toBeGreaterThanOrEqual(1800)
    expect(holdMs).toBeLessThanOrEqual(2500)
  })

  it("resets in a reverse stagger, the last change first, inside half a second", async () => {
    const { partChanges } = await demoFixture(false)
    const lastAddedFirst = ["source", "table-row-0", "cagr-line", "bar-0-0", "answer-title", "user-message"]
    const exits = lastAddedFirst.map((part) => lastChangeTo(partChanges(part, "opacity"), "0"))
    const gaps = exits.slice(1).map((exit, index) => exit.startMs - exits[index].startMs)
    expect(gaps[0]).toBe(0)
    for (const gap of gaps.slice(1)) {
      expect(gap).toBeGreaterThanOrEqual(40)
      expect(gap).toBeLessThanOrEqual(80)
    }
    const resetEndMs = Math.max(...exits.map((exit) => exit.endMs))
    expect(resetEndMs - exits[0].startMs).toBeLessThanOrEqual(500)
    for (const part of ["blank-stage", "composer-draft", "composer-placeholder"]) {
      expect(lastChangeTo(partChanges(part, "opacity"), "1").endMs).toBe(resetEndMs)
    }
  })

  it("starts the next action within a second of the reset ending", async () => {
    const { animationOf, partChanges, loopMs } = await demoFixture(false)
    const resetEndMs = lastChangeTo(partChanges("user-message", "opacity"), "0").endMs
    const firstMoveMs = changes(animationOf("[data-demo-cursor]", "transform"), "transform")[0].startMs
    expect(loopMs - resetEndMs + firstMoveMs).toBeLessThanOrEqual(1000)
  })

  it("moves the cursor on the travel curve and dwells before each press", async () => {
    const { animationOf } = await demoFixture(false)
    const moves = changes(animationOf("[data-demo-cursor]", "transform"), "transform")
    const pressChanges = changes(animationOf("[data-demo-cursor-press]", "transform"), "transform")
    const presses = pressChanges.filter((change) => change.from === "scale(1)")
    const releases = pressChanges.filter((change) => change.to === "scale(1)")
    expect(presses).toHaveLength(3)
    for (const move of moves) {
      expect(move.easing).toBe(travelCurve)
    }
    presses.forEach((press, index) => {
      expect(press.to).toBe("scale(0.9)")
      const arrival = moves.filter((move) => move.endMs <= press.startMs).at(-1)
      const dwellMs = press.startMs - (arrival?.endMs ?? Number.NaN)
      expect(dwellMs).toBeGreaterThanOrEqual(150)
      expect(dwellMs).toBeLessThanOrEqual(250)
      const release = releases[index]
      expect(release.endMs - release.startMs).toBeGreaterThan(press.endMs - press.startMs)
      const departure = moves.find((move) => move.startMs >= press.startMs)
      expect(departure?.startMs).toBeGreaterThanOrEqual(release.endMs)
    })
  })

  it("rolls the draft title out as the answer title rolls in", async () => {
    const { partChanges } = await demoFixture(false)
    const leave = lastChangeTo(partChanges("draft-title", "opacity"), "0")
    const lift = lastChangeTo(partChanges("draft-title", "transform"), "translateY(-4px)")
    const enter = lastChangeTo(partChanges("answer-title", "opacity"), "1")
    expect(lift.startMs).toBe(leave.startMs)
    expect(lift.endMs).toBe(leave.endMs)
    expect(enter.startMs).toBeGreaterThan(leave.startMs)
    expect(leave.endMs - enter.startMs).toBeGreaterThan(0)
    expect(leave.endMs - enter.startMs).toBeLessThanOrEqual(80)
  })

  it("plays while it is in view and pauses when it is not", async () => {
    const { recorded, show } = await demoFixture(false)
    show(true)
    expect(recorded.every((animation) => animation.playing)).toBe(true)
    show(false)
    expect(recorded.some((animation) => animation.playing)).toBe(false)
  })
})
