import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { FormatButtons } from "@/editor/format-buttons"

function buttons(markup: string): string[] {
  return [...markup.matchAll(/<button[^>]*>/g)].map((tag) => tag[0])
}

it("names each button by its action and says its state for the selection", () => {
  const markup = renderToStaticMarkup(
    <FormatButtons shown={{ bold: "on", italic: "off", underline: "mixed" }} onToggle={() => undefined} />,
  )
  expect(markup).toContain('role="group"')
  expect(markup).toContain('aria-label="Text format"')
  expect(markup).toContain("data-text-format")
  const tags = buttons(markup)
  expect(tags.map((tag) => /aria-label="([^"]*)"/.exec(tag)?.[1])).toEqual(["Bold", "Italic", "Underline"])
  expect(tags.map((tag) => /aria-pressed="([^"]*)"/.exec(tag)?.[1])).toEqual(["true", "false", "mixed"])
  expect(tags.map((tag) => /aria-keyshortcuts="([^"]*)"/.exec(tag)?.[1])).toEqual([
    "Control+B Meta+B",
    "Control+I Meta+I",
    "Control+U Meta+U",
  ])
})
