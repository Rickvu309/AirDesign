import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
import App from "@/App"
import { productCopy } from "@/copy/product-copy"

function appAt(path: string): string {
  vi.stubGlobal("window", {
    location: { pathname: path, search: "", assign() {}, replace() {} },
    history: { pushState() {} },
    addEventListener() {},
    removeEventListener() {},
  })
  try {
    return renderToStaticMarkup(<App />)
  } finally {
    vi.unstubAllGlobals()
  }
}

it("shows a not-found page with a link to the decks for an address nothing serves", () => {
  const html = appAt("/no-such-page")
  expect(html).toContain(productCopy.addressNotFoundTitle)
  expect(html).toMatch(new RegExp(`<a href="/"[^>]*>${productCopy.goToDecks}</a>`))
  expect(html).not.toContain("Unknown screen")
  expect(html).toContain("data-not-found-live")
})

it("shows the same page for an old address and for a deck id that cannot exist", () => {
  expect(appAt("/thin")).toContain(productCopy.addressNotFoundTitle)
  expect(appAt("/deck/invalid.id")).toContain(productCopy.addressNotFoundTitle)
})
