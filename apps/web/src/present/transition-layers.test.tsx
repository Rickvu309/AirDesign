import type { Props } from "@airdesign/doom"
import { act, createElement } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot
let TransitionLayers: typeof import("./transition-layers").TransitionLayers

beforeAll(async () => {
  const module = "jsdom"
  const { JSDOM } = await import(module)
  window = new JSDOM("<!doctype html><html><body></body></html>").window
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    MutationObserver: window.MutationObserver,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    vi.stubGlobal(name, value)
  createRoot = (await import("react-dom/client")).createRoot
  TransitionLayers = (await import("./transition-layers")).TransitionLayers
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

const fade: Props["transition"] = { kind: "fade", ms: 400 }

function show(transitionOf: (index: number) => Props["transition"] | null, waitingFor: readonly number[]) {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const played: HTMLElement[] = []
  const finishers: (() => void)[] = []
  Object.defineProperty(window.HTMLElement.prototype, "getAnimations", { configurable: true, value: () => [] })
  Object.defineProperty(window.HTMLElement.prototype, "animate", {
    configurable: true,
    value(this: HTMLElement) {
      played.push(this)
      return {
        finished: new Promise<void>((done) => finishers.push(done)),
        cancel: () => undefined,
      }
    },
  })
  const root = createRoot(host)
  const morphOf = () => []
  const paint = (index: number) =>
    createElement("div", {
      "data-slide": String(index + 1),
      ...(waitingFor.includes(index) ? { "data-fonts-pending": "" } : {}),
    })
  const goTo = (at: number) =>
    act(() => {
      root.render(
        createElement(TransitionLayers, {
          at,
          width: 800,
          size: { width: 1920, height: 1080 },
          paint,
          transitionOf,
          morphOf,
        }),
      )
    })
  const slideIn = (selector: string) => host.querySelector<HTMLElement>(selector)?.querySelector("[data-slide]")
  const release = async (slide: number) => {
    host.querySelector(`[data-slide="${String(slide)}"]`)?.removeAttribute("data-fonts-pending")
    await act(async () => Promise.resolve())
  }
  const finish = async () => {
    for (const done of finishers.splice(0)) done()
    await act(async () => Promise.resolve())
  }
  return { host, played, goTo, slideIn, release, finish, unmount: () => act(() => root.unmount()) }
}

it("keeps the painted slide in front while the next one waits for its fonts, then plays the transition from it", async () => {
  const stage = show(() => fade, [1])
  stage.goTo(0)
  stage.goTo(1)
  expect(stage.slideIn("[data-present-leaving]")?.getAttribute("data-slide")).toBe("1")
  const incoming = stage.host.querySelector<HTMLElement>("[data-present-incoming]")
  expect(incoming?.style.visibility).toBe("hidden")
  expect(stage.played).toHaveLength(0)

  await stage.release(2)
  expect(stage.played).toEqual([incoming])
  expect(incoming?.style.visibility).toBe("")
  expect(stage.slideIn("[data-present-leaving]")?.getAttribute("data-slide")).toBe("1")

  await stage.finish()
  expect(stage.host.querySelector("[data-present-leaving]")).toBeNull()
  expect(stage.slideIn("[data-present-incoming]")?.getAttribute("data-slide")).toBe("2")
  stage.unmount()
})

it("a second Next while the first slide still waits keeps the painted slide in front, and plays from it to where the show landed", async () => {
  const stage = show((index) => (index === 2 ? fade : null), [1, 2])
  stage.goTo(0)
  const painted = stage.host.querySelector("[data-present-incoming]")
  stage.goTo(1)
  stage.goTo(2)
  expect(stage.host.querySelector("[data-present-leaving]")).toBe(painted)
  expect(stage.slideIn("[data-present-leaving]")?.getAttribute("data-slide")).toBe("1")
  expect(stage.slideIn("[data-present-incoming]")?.getAttribute("data-slide")).toBe("3")
  expect(stage.host.querySelectorAll("[data-slide]")).toHaveLength(2)
  expect(stage.played).toHaveLength(0)

  await stage.release(3)
  expect(stage.played).toEqual([stage.host.querySelector("[data-present-incoming]")])
  expect(stage.host.querySelector("[data-present-leaving]")).toBe(painted)
  stage.unmount()
})

it("a Next during a transition keeps the slide that was arriving, since it has painted", async () => {
  const stage = show(() => fade, [2])
  stage.goTo(0)
  stage.goTo(1)
  expect(stage.played).toHaveLength(1)
  const arriving = stage.host.querySelector("[data-present-incoming]")
  stage.goTo(2)
  expect(stage.host.querySelector("[data-present-leaving]")).toBe(arriving)
  expect(stage.slideIn("[data-present-leaving]")?.getAttribute("data-slide")).toBe("2")
  stage.unmount()
})

it("swaps a slide with no transition only once it has painted", async () => {
  const stage = show(() => null, [1])
  stage.goTo(0)
  stage.goTo(1)
  expect(stage.slideIn("[data-present-leaving]")?.getAttribute("data-slide")).toBe("1")
  await stage.release(2)
  expect(stage.host.querySelector("[data-present-leaving]")).toBeNull()
  expect(stage.played).toHaveLength(0)
  expect(stage.slideIn("[data-present-incoming]")?.getAttribute("data-slide")).toBe("2")
  stage.unmount()
})

it("going back to the painted slide while the next one waits drops the waiting one", () => {
  const stage = show(() => fade, [1])
  stage.goTo(0)
  stage.goTo(1)
  stage.goTo(0)
  expect(stage.host.querySelector("[data-present-leaving]")).toBeNull()
  expect(stage.host.querySelectorAll("[data-slide]")).toHaveLength(1)
  expect(stage.slideIn("[data-present-incoming]")?.getAttribute("data-slide")).toBe("1")
  stage.unmount()
})
