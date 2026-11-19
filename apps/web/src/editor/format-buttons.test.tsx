import { renderToStaticMarkup } from "react-dom/server"
import { act } from "react"
import type { Root } from "react-dom/client"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { designCopy } from "@/copy/design-copy"
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
  expect(markup).toMatch(/<input[^>]*aria-label="Font size"[^>]*value="18"/)
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
    "Bulleted list",
  ])
  expect(tags.slice(0, 3).map((tag) => /aria-pressed="([^"]*)"/.exec(tag)?.[1])).toEqual(["true", "false", "mixed"])
  expect(tags.slice(0, 3).map((tag) => /aria-keyshortcuts="([^"]*)"/.exec(tag)?.[1])).toEqual([
    "Control+B Meta+B",
    "Control+I Meta+I",
    "Control+U Meta+U",
  ])
  expect(markup).toContain('aria-haspopup="dialog"')
  expect(markup).toContain('aria-checked="true"')
  expect(markup).toContain('aria-label="Bulleted list"')
  expect(markup).toContain('aria-pressed="false"')
})

it("draws only the parts a narrow toolbar keeps, so the rest can sit in More", () => {
  const labels = (markup: string) => buttons(markup).map((tag) => /aria-label="([^"]*)"/.exec(tag)?.[1])
  const shown = { bold: "off", italic: "off", underline: "off" } as const
  const row = renderToStaticMarkup(<FormatButtons shown={shown} parts={["styles", "size"]} />)
  const more = renderToStaticMarkup(<FormatButtons shown={shown} parts={["color", "align", "bullets"]} />)
  expect(labels(row)).toEqual(["Bold", "Italic", "Underline", "Smaller", "Larger"])
  expect(row).toMatch(/<input[^>]*value="18"/)
  expect(labels(more)).toEqual(["Text color", "Align left", "Align center", "Align right", "Bulleted list"])
  expect(more).not.toContain("data-text-format")
})

it("shows a mixed size as Mixed in an empty box that still takes a typed size", () => {
  const shown = { bold: "off", italic: "off", underline: "off" } as const
  const markup = renderToStaticMarkup(<FormatButtons shown={shown} size="mixed" parts={["size"]} />)
  expect(markup).toContain('aria-label="Font size, mixed"')
  expect(markup).toMatch(/<input[^>]*value=""/)
  expect(markup).toContain(`placeholder="${designCopy.mixed}"`)
  expect(markup).toContain('inputMode="decimal"')
  expect(markup).toContain("data-keeps-format")
})

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot

beforeAll(async () => {
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as {
    JSDOM: new (html: string) => { readonly window: Window & typeof globalThis }
  }
  window = new jsdom.JSDOM("<!doctype html><html><body></body></html>").window
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    vi.stubGlobal(name, value)
  createRoot = (await import("react-dom/client")).createRoot
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

it.each(["blur", "Enter", "Escape", "invalid", "unchanged", "Enter unchanged"] as const)(
  "handles a typed size followed by %s and blur once",
  (action) => {
    const host = window.document.createElement("div")
    window.document.body.append(host)
    const calls: (readonly [number, boolean | undefined])[] = []
    const root: Root = createRoot(host)
    try {
      act(() =>
        root.render(
          <FormatButtons
            shown={{ bold: "off", italic: "off", underline: "off" }}
            parts={["size"]}
            size={1800}
            onSize={(size, focus) => {
              calls.push([size, focus])
              host.querySelector("input")?.blur()
            }}
          />,
        ),
      )
      const field = host.querySelector("input")
      if (field === null) throw new Error("missing font size")
      act(() => field.focus())
      const typed = action === "invalid" ? ["big"] : action.endsWith("unchanged") ? ["1", "18"] : ["24,5"]
      for (const text of typed) {
        act(() => {
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(field, text)
          field.dispatchEvent(new window.Event("input", { bubbles: true }))
        })
      }
      if (action !== "blur" && action !== "invalid" && action !== "unchanged") {
        const key = action === "Escape" ? "Escape" : "Enter"
        act(() => field.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true })))
      }
      act(() => field.blur())
      const commits = {
        blur: [[2450, false]],
        Enter: [[2450, true]],
        Escape: [],
        invalid: [],
        unchanged: [],
        "Enter unchanged": [[1800, true]],
      }
      expect(calls).toEqual(commits[action])
      expect(field.value).toBe("18")
    } finally {
      act(() => root.unmount())
      host.remove()
    }
  },
)
