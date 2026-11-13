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
  expect(markup).toContain('aria-label="Font size"')
  expect(markup).toContain('role="radiogroup"')
  expect(markup).toContain('aria-label="Alignment"')
  expect(markup).toContain("data-text-format")
  expect(markup).toContain(">18<")
  const tags = buttons(markup)
  expect(tags.map((tag) => /aria-label="([^"]*)"/.exec(tag)?.[1])).toEqual([
    "Bold",
    "Italic",
    "Underline",
    "Smaller",
    "Larger",
    "Text color",
    "Align left",
    "Align center",
    "Align right",
    "Bullets",
  ])
  expect(tags.slice(0, 3).map((tag) => /aria-pressed="([^"]*)"/.exec(tag)?.[1])).toEqual(["true", "false", "mixed"])
  expect(tags.slice(0, 3).map((tag) => /aria-keyshortcuts="([^"]*)"/.exec(tag)?.[1])).toEqual([
    "Control+B Meta+B",
    "Control+I Meta+I",
    "Control+U Meta+U",
  ])
  expect(markup).toContain('aria-haspopup="menu"')
  expect(markup).toContain('aria-checked="true"')
  expect(markup).toContain('aria-label="Bullets"')
  expect(markup).toContain('aria-pressed="false"')
})
