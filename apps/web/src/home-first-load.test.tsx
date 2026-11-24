import { renderToStaticMarkup } from "react-dom/server"
import { afterAll, expect, it, vi } from "vitest"

const { loadedOnHome } = vi.hoisted(() => {
  vi.stubGlobal("window", {
    location: { pathname: "/", search: "", assign() {}, replace() {} },
    history: { pushState() {} },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
  })
  return {
    loadedOnHome: (name: string) => () => {
      throw new Error(`the home page loaded ${name}`)
    },
  }
})

vi.mock("@/thin-deck", loadedOnHome("the editor"))
vi.mock("@/screen-routes", loadedOnHome("the design screens"))

const { default: App } = await import("@/App")

afterAll(() => {
  vi.unstubAllGlobals()
})

it("paints the deck home without loading the editor or the design screens", () => {
  expect(renderToStaticMarkup(<App />)).toContain("data-decks-main")
})
