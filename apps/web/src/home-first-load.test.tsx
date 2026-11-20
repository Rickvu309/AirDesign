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
vi.mock("@/decks/first-slide", loadedOnHome("the slide painter"))
vi.mock("@/import-deck", loadedOnHome("the PowerPoint reader"))

const { default: App } = await import("@/App")

afterAll(() => {
  vi.unstubAllGlobals()
})

it("paints the deck home without loading the editor, the screens, the slide painter or the PowerPoint reader", () => {
  expect(renderToStaticMarkup(<App />)).toContain("data-decks-main")
})
