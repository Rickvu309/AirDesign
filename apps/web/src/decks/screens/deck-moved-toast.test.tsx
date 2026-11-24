import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { productCopy } from "@/copy/product-copy"
import { MovedToast } from "./deck-moved-toast"

function notice(name?: string) {
  return renderToStaticMarkup(name === undefined ? <MovedToast /> : <MovedToast name={name} />)
}

function nameBox(markup: string, name: string) {
  const box = markup.match(new RegExp(`<bdi[^>]*title="${name}"[^>]*>${name}</bdi>`))
  expect(box, markup).not.toBeNull()
  return box?.[0] ?? ""
}

it("shows a normal deck name in full and keeps the action words outside any cut", () => {
  const name = "Pricing Strategy Review"
  const markup = notice()
  const box = nameBox(markup, name)
  expect(box).toContain("line-clamp-2")
  expect(box).not.toContain("moved to Trash")
  expect(markup).toContain("moved to Trash")
  expect(markup.indexOf("moved to Trash")).toBeGreaterThan(markup.indexOf(`>${name}<`))
  expect(markup).toContain(`>${productCopy.undo}<`)
  expect(markup).not.toContain("truncate")
  expect(markup).toContain("h-auto")
  expect(markup.replaceAll("min-h-10", "")).not.toContain("h-10")
})

it("cuts only a very long deck name and leaves the action words whole", () => {
  const name = "Quarterly pricing strategy review for the board and every regional lead"
  const markup = notice(name)
  const box = nameBox(markup, name)
  expect(box).toContain("line-clamp-2")
  expect(markup).not.toContain("whitespace-pre")
  expect(markup).toContain(">moved to Trash<")
  expect(box).toContain("mr-1")
  expect(markup).not.toMatch(/line-clamp-2[^>]*>[^<]*moved to Trash/)
})
