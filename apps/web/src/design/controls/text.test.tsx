import { cellText, readTextValue, traits, writeTextValue, type TextValue } from "@airdesign/document"
import { act, createElement } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import type { ControlProps } from "@/design/panel"

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot
let TextControl: typeof import("./text").TextControl
let typedText: typeof import("./text").typedText

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
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    vi.stubGlobal(name, value)
  createRoot = (await import("react-dom/client")).createRoot
  ;({ TextControl, typedText } = await import("./text"))
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

it.each([
  ["A".repeat(8001), ""],
  ["é".repeat(4001), " Some letters and emoji count as 2 to 4."],
  ['"'.repeat(4000), ""],
])("keeps over-limit Text on save and blur, then saves its correction", async (typed, caveat) => {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  const onChange = vi.fn()
  const props: ControlProps = {
    row: {
      trait: "text",
      field: "value",
      label: "Text",
      control: "text",
      desc: traits.text.fields.value.desc,
      value: "Hello",
      mixed: false,
      inherited: false,
      caption: false,
      reset: null,
      change: () => {
        throw new Error("unused")
      },
    },
    palette: { theme: [], deck: [] },
    onChange,
  }
  try {
    await act(async () => root.render(createElement(TextControl, props)))
    const input = host.querySelector("textarea")
    if (input === null) throw new Error("Text")
    async function enter(text: string) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set?.call(input, text)
        input?.dispatchEvent(new window.Event("input", { bubbles: true }))
      })
    }
    await enter(typed)
    expect(input.getAttribute("aria-invalid")).toBe("true")
    const id = input.getAttribute("aria-describedby") ?? ""
    expect(window.document.getElementById(id)?.textContent).toBe(
      `Use less text. This box holds up to 8,000 characters, including formatting.${caveat}`,
    )
    await act(async () => {
      input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }))
      input.dispatchEvent(new window.Event("focusout", { bubbles: true }))
    })
    expect(input.value).toBe(typed)
    expect(onChange).not.toHaveBeenCalled()
    await enter("Corrected text")
    expect(input.hasAttribute("aria-invalid")).toBe(false)
    await act(async () => input.dispatchEvent(new window.Event("focusout", { bubbles: true })))
    expect(onChange).toHaveBeenCalledOnce()
    expect(cellText(readTextValue(onChange.mock.calls[0]?.[0]) ?? [])).toBe("Corrected text")
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})

const mixed: TextValue = [
  {
    from: 0,
    align: "center",
    runs: [
      { from: 0, text: "Revenue " },
      { from: 1, text: "39%", bold: true, color: { rgb: "C00000" } },
    ],
  },
  {
    from: 2,
    bullet: true,
    runs: [
      { from: 2, text: "Costs ", font: "Georgia" },
      { from: 3, text: "fell", italic: true, size: 2400 },
    ],
  },
]

it.each<[string, string, TextValue]>([
  [
    "a letter added at the end of the first paragraph",
    "Revenue 39%!\nCosts fell",
    [{ ...mixed[0]!, runs: [mixed[0]!.runs[0]!, { ...mixed[0]!.runs[1]!, text: "39%!" }] }, mixed[1]!],
  ],
  [
    "a word changed in the second paragraph",
    "Revenue 39%\nCosts rose",
    [mixed[0]!, { ...mixed[1]!, runs: [mixed[1]!.runs[0]!, { ...mixed[1]!.runs[1]!, text: "rose" }] }],
  ],
  [
    "a new line typed after the first paragraph",
    "Revenue 39%\nMargin\nCosts fell",
    [mixed[0]!, { ...mixed[1]!, runs: [{ ...mixed[1]!.runs[0]!, text: "Margin" }] }, mixed[1]!],
  ],
  ["the same words", "Revenue 39%\nCosts fell", mixed],
])("keeps every run's format the words did not change after %s", (_, words, kept) => {
  expect(readTextValue(typedText(writeTextValue(mixed), words))).toEqual(kept)
})

it("keeps untouched runs when both paragraphs are corrected before committing", async () => {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  const onChange = vi.fn()
  try {
    await act(async () =>
      root.render(
        createElement(TextControl, {
          row: {
            trait: "text",
            field: "value",
            label: "Text",
            control: "text",
            desc: traits.text.fields.value.desc,
            value: writeTextValue(mixed),
            mixed: false,
            inherited: false,
            caption: false,
            reset: null,
            change: () => {
              throw new Error("unused")
            },
          },
          palette: { theme: [], deck: [] },
          onChange,
        }),
      ),
    )
    const input = host.querySelector("textarea")
    if (input === null) throw new Error("Text")
    for (const [words, start, end] of [
      ["Revenue 39%!\nCosts fell", 11, 11],
      ["Revenue 39%!\nCosts rose", 19, 23],
    ] satisfies [string, number, number][]) {
      input.setSelectionRange(start, end)
      await act(async () => {
        input.dispatchEvent(new window.InputEvent("beforeinput", { bubbles: true, inputType: "insertText" }))
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set?.call(input, words)
        input.dispatchEvent(new window.Event("input", { bubbles: true }))
      })
    }
    expect(onChange).not.toHaveBeenCalled()
    await act(async () => input.dispatchEvent(new window.Event("focusout", { bubbles: true })))
    expect(onChange).toHaveBeenCalledOnce()
    expect(readTextValue(onChange.mock.calls[0]?.[0])).toEqual([
      { ...mixed[0]!, runs: [mixed[0]!.runs[0]!, { ...mixed[0]!.runs[1]!, text: "39%!" }] },
      { ...mixed[1]!, runs: [mixed[1]!.runs[0]!, { ...mixed[1]!.runs[1]!, text: "rose" }] },
    ])
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})

it.each([
  ["forward Delete", 0, 0, "deleteContentForward", "1", 1],
  ["Backspace", 1, 1, "deleteContentBackward", "1", 1],
  ["selected deletion", 0, 1, "deleteContentForward", "1", 1],
  ["last Backspace", 2, 2, "deleteContentBackward", "1", 0],
  ["selected replacement", 0, 1, "insertText", "21", 1],
])("keeps the untouched repeated character after %s", async (_, start, end, inputType, words, survivor) => {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  const onChange = vi.fn()
  const runs = [
    { from: 0, text: "1" },
    { from: 1, text: "1", bold: true, color: { rgb: "C00000" } },
  ]
  try {
    await act(async () =>
      root.render(
        createElement(TextControl, {
          row: {
            trait: "text",
            field: "value",
            label: "Text",
            control: "text",
            desc: traits.text.fields.value.desc,
            value: writeTextValue([{ from: 0, runs }]),
            mixed: false,
            inherited: false,
            caption: false,
            reset: null,
            change: () => {
              throw new Error("unused")
            },
          },
          palette: { theme: [], deck: [] },
          onChange,
        }),
      ),
    )
    const input = host.querySelector("textarea")
    if (input === null) throw new Error("Text")
    input.setSelectionRange(start, end)
    await act(async () => {
      input.dispatchEvent(new window.InputEvent("beforeinput", { bubbles: true, inputType }))
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set?.call(input, words)
      input.dispatchEvent(new window.InputEvent("input", { bubbles: true, inputType }))
    })
    await act(async () => input.dispatchEvent(new window.Event("focusout", { bubbles: true })))
    const saved = readTextValue(onChange.mock.calls[0]?.[0])
    expect(saved?.[0]?.runs.at(-1)).toEqual(runs[survivor])
    expect(cellText(saved ?? [])).toBe(words)
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
