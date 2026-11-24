import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
import { DeckTitleEdit } from "./deck-title-edit"
import { productCopy } from "@/copy/product-copy"
import type { ReactNode } from "react"

vi.mock("./editor-menu", () => ({
  EditorMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

it("offers separate rename and deck action buttons", () => {
  const markup = renderToStaticMarkup(<DeckTitleEdit title="Plan" onRename={() => undefined} />)
  expect(markup.match(/<button/g)).toHaveLength(2)
  expect(markup).toContain('aria-label="Rename deck: Plan"')
  expect(markup).toContain('aria-label="Plan actions"')
})

it("keeps a title without rename plain", async () => {
  const { DeckTitle } = await import("./editor-chrome")
  expect(renderToStaticMarkup(<DeckTitle title="Plan" />)).not.toContain("<button")
})

it("offers only Rename when Trash is unavailable", () => {
  const markup = renderToStaticMarkup(<DeckTitleEdit title="Plan" onRename={() => undefined} />)
  expect(markup).toContain(`>${productCopy.rename}<`)
  expect(markup).not.toContain(productCopy.moveToTrash)
})

it("offers Trash when its handler is available", () => {
  const markup = renderToStaticMarkup(
    <DeckTitleEdit title="Plan" onRename={() => undefined} onTrash={() => undefined} />,
  )
  expect(markup).toContain(productCopy.moveToTrash)
})

it("puts a normal deck name on its own row, still able to ellipsize", async () => {
  const { SidebarHead } = await import("./editor-chrome")
  const title = "Annual strategy review"
  const markup = renderToStaticMarkup(<SidebarHead title={title} homeHref="/" onRename={() => undefined} />)
  expect(markup).not.toContain("minmax(0,1fr)")
  const home = markup.indexOf(`aria-label="${productCopy.goToDecks}"`)
  const name = markup.indexOf(`aria-label="Rename deck: ${title}"`)
  expect(home).toBeGreaterThan(-1)
  expect(name).toBeGreaterThan(home)
  expect(markup).not.toContain('aria-label="Grid"')
  expect(markup).toContain("truncate")
})
