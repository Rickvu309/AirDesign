import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { elementId, readTextValue, writeTextValue, type TextValue } from "@airdesign/document"
import { afterEach, describe, expect, it } from "vitest"
import { Passage, paintStore } from "./index.js"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

async function render(node: ReactNode): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(node)
  })
  return { host, root }
}

function editorIn(host: HTMLElement): HTMLElement {
  const editor = host.querySelector("[contenteditable]")
  if (!(editor instanceof HTMLElement)) throw new Error("missing passage")
  return editor
}

function textIn(editor: HTMLElement): Text {
  const node = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT).nextNode()
  if (!(node instanceof Text)) throw new Error("missing text")
  return node
}

function lines(value: string | undefined): string | undefined {
  const read = value === undefined ? null : readTextValue(value)
  if (read === null) return value
  return read.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n")
}

function runText(editor: HTMLElement, index: number): Text {
  const run = editor.querySelectorAll("[data-run]")[index]
  const node = run?.firstChild
  if (!(node instanceof Text)) throw new Error("missing run")
  return node
}

function caretAt(node: Text, offset: number): Selection {
  node.parentElement?.closest<HTMLElement>("[contenteditable]")?.focus()
  const selection = window.getSelection()
  if (selection === null) throw new Error("missing selection")
  const range = document.createRange()
  range.setStart(node, offset)
  range.setEnd(node, offset)
  selection.removeAllRanges()
  selection.addRange(range)
  return selection
}

async function typeInto(editor: HTMLElement, value: string): Promise<Text> {
  const node = textIn(editor)
  node.nodeValue = value
  caretAt(node, value.length)
  await act(async () => {
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }))
  })
  return node
}

function show(store: ReturnType<typeof paintStore>, id: ReturnType<typeof elementId>, text: string): Promise<void> {
  return act(async () => {
    expect(store.publish({ id, kind: "shape", text, picture: null })).toEqual({ ok: true })
  })
}

describe("Passage", () => {
  it("composition keeps the text node", async () => {
    const store = paintStore()
    const id = elementId("1.1")
    expect(store.publish({ id, kind: "shape", text: "hello", picture: null })).toEqual({ ok: true })
    function Parent(props: { readonly generation: number }) {
      return createElement("div", { "data-generation": props.generation }, createElement(Passage, { store, id }))
    }
    const mounted = await render(createElement(Parent, { generation: 0 }))
    const host = mounted.host
    const editor = host.querySelector("[contenteditable]")
    if (!(editor instanceof HTMLElement)) throw new Error("missing passage")
    editor.focus()
    const textNode = textIn(editor)
    const selection = window.getSelection()
    if (selection === null) throw new Error("missing selection")
    const range = document.createRange()
    range.setStart(textNode, 1)
    range.setEnd(textNode, 4)
    selection.removeAllRanges()
    selection.addRange(range)
    const active = document.activeElement

    await act(async () => {
      editor.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))
      editor.dispatchEvent(new CompositionEvent("compositionupdate", { bubbles: true, data: "helloあ" }))
    })
    textNode.nodeValue = "helloあ"
    range.setStart(textNode, 1)
    range.setEnd(textNode, 4)
    selection.removeAllRanges()
    selection.addRange(range)
    await act(async () => {
      mounted.root.render(createElement(Parent, { generation: 1 }))
    })

    expect(textIn(editor)).toBe(textNode)
    expect(textNode.nodeValue).toBe("helloあ")
    expect(document.activeElement).toBe(active)
    expect(selection.rangeCount).toBe(1)
    const during = selection.getRangeAt(0)
    expect(during).toBe(range)
    expect(during.startContainer).toBe(textNode)
    expect(during.startOffset).toBe(1)
    expect(during.endOffset).toBe(4)
    expect(store.getElement(id)?.text).toBe("hello")

    const record = store.getElement(id)
    if (record === null) throw new Error("missing record")
    store.publish({ id: record.id, kind: record.kind, text: "outside", picture: record.picture })
    expect(textIn(editor)).toBe(textNode)
    expect(store.getElement(id)?.text).toBe("hello")

    const seen: string[] = []
    store.elementSubscribe(id)(() => {
      const text = store.getElement(id)?.text
      if (text !== undefined) seen.push(text)
    })
    await act(async () => {
      editor.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "helloあ" }))
    })

    expect(lines(seen[0])).toBe("helloあ")
    expect(store.getElement(id)?.text).toBe("outside")
  })

  it("reports committed text and stays quiet during composition", async () => {
    const seen: string[] = []
    const store = paintStore()
    const id = elementId("1.1")
    expect(store.publish({ id, kind: "shape", text: "hello", picture: null })).toEqual({ ok: true })
    const mounted = await render(
      createElement(Passage, {
        store,
        id,
        onEdit: (value) => {
          seen.push(value)
        },
      }),
    )
    const editor = mounted.host.querySelector("[contenteditable]")
    if (!(editor instanceof HTMLElement)) throw new Error("missing passage")
    const textNode = editor.firstChild
    await act(async () => {
      editor.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))
      editor.dispatchEvent(new CompositionEvent("compositionupdate", { bubbles: true, data: "helloあ" }))
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, data: "あ" }))
    })
    expect(seen).toEqual([])
    expect(editor.firstChild).toBe(textNode)
    editor.textContent = "helloあ"
    await act(async () => {
      editor.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "helloあ" }))
    })
    expect(seen.map(lines)).toEqual(["helloあ"])
    editor.textContent = "Hello!"
    await act(async () => {
      editor.dispatchEvent(new InputEvent("input", { bubbles: true }))
    })
    expect(seen.map(lines)).toEqual(["helloあ", "Hello!"])
  })

  it("an echo of its own value keeps the text node and the caret", async () => {
    const store = paintStore()
    const id = elementId("1.1")
    await show(store, id, "Hello")
    const mounted = await render(
      createElement(Passage, {
        store,
        id,
        onEdit: (value) => {
          store.publish({ id, kind: "shape", text: value, picture: null })
        },
      }),
    )
    const editor = editorIn(mounted.host)
    const typed = await typeInto(editor, "Hello!")
    const selection = window.getSelection()

    expect(lines(store.getElement(id)?.text)).toBe("Hello!")
    expect(textIn(editor)).toBe(typed)
    expect(editor.childNodes.length).toBe(1)
    expect(typed.nodeValue).toBe("Hello!")
    expect(selection?.rangeCount).toBe(1)
    expect(selection?.getRangeAt(0).startContainer).toBe(typed)
    expect(selection?.getRangeAt(0).startOffset).toBe(6)
    expect(selection?.getRangeAt(0).endOffset).toBe(6)
  })

  it("a late echo of an older value keeps the newer typed text", async () => {
    const sent: string[] = []
    const store = paintStore()
    const id = elementId("1.1")
    await show(store, id, "")
    const mounted = await render(
      createElement(Passage, {
        store,
        id,
        onEdit: (value) => {
          sent.push(value)
        },
      }),
    )
    const editor = editorIn(mounted.host)
    editor.textContent = "a"
    await typeInto(editor, "a")
    const typed = await typeInto(editor, "ab")
    expect(sent.map(lines)).toEqual(["a", "ab"])

    await show(store, id, sent[0] ?? "")
    expect(editor.textContent).toBe("ab")
    expect(textIn(editor)).toBe(typed)
    expect(window.getSelection()?.getRangeAt(0).startContainer).toBe(typed)
    expect(window.getSelection()?.getRangeAt(0).startOffset).toBe(2)

    await show(store, id, sent[1] ?? "")
    expect(editor.textContent).toBe("ab")
    expect(textIn(editor)).toBe(typed)
    expect(window.getSelection()?.getRangeAt(0).startOffset).toBe(2)

    await show(store, id, "a")
    expect(editor.textContent).toBe("a")
    expect(window.getSelection()?.getRangeAt(0).startOffset).toBe(1)
  })

  it("a value from elsewhere replaces the text and keeps the caret, clamped", async () => {
    const sent: string[] = []
    const store = paintStore()
    const id = elementId("1.1")
    await show(store, id, "Hello world")
    const mounted = await render(
      createElement(Passage, {
        store,
        id,
        onEdit: (value) => {
          sent.push(value)
        },
      }),
    )
    const editor = editorIn(mounted.host)
    const selection = caretAt(textIn(editor), 8)

    await show(store, id, "Hello wide world")
    expect(editor.textContent).toBe("Hello wide world")
    expect(selection.rangeCount).toBe(1)
    expect(selection.getRangeAt(0).startContainer).toBe(textIn(editor))
    expect(selection.getRangeAt(0).startOffset).toBe(8)
    expect(selection.getRangeAt(0).endOffset).toBe(8)

    await show(store, id, "Hey")
    expect(editor.textContent).toBe("Hey")
    expect(selection.getRangeAt(0).startContainer).toBe(textIn(editor))
    expect(selection.getRangeAt(0).startOffset).toBe(3)
    expect(selection.getRangeAt(0).endOffset).toBe(3)

    await show(store, id, "")
    expect(editor.textContent).toBe("")
    expect(selection.getRangeAt(0).startContainer).toBe(editor.firstChild)
    expect(selection.getRangeAt(0).startOffset).toBe(0)
    expect(sent).toEqual([])
  })

  it("a passage that cannot store an edit is not editable", async () => {
    const store = paintStore()
    const id = elementId("1.1")
    await show(store, id, "Hello")
    const fixed = await render(createElement(Passage, { store, id }))
    expect(fixed.host.querySelector('[contenteditable="true"]')).toBeNull()
    expect(editorIn(fixed.host).getAttribute("contenteditable")).toBe("false")
    expect(editorIn(fixed.host).textContent).toBe("Hello")

    const stored = await render(createElement(Passage, { store, id, onEdit: () => undefined }))
    expect(editorIn(stored.host).getAttribute("contenteditable")).toBe("true")
  })

  it("refuses Enter only outside a composition", async () => {
    const store = paintStore()
    const id = elementId("1.1")
    expect(store.publish({ id, kind: "shape", text: "hello", picture: null })).toEqual({ ok: true })
    const { host } = await render(createElement(Passage, { store, id, onEdit: () => undefined }))
    const editor = editorIn(host)
    function pressEnter(isComposing: boolean): boolean {
      const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, isComposing })
      editor.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(pressEnter(false)).toBe(true)
    expect(pressEnter(true)).toBe(false)
    await act(async () => {
      editor.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))
    })
    expect(pressEnter(false)).toBe(false)
  })
})

describe("Passage paragraphs", () => {
  it("Enter splits the paragraph at the caret and the new one keeps the run's from", async () => {
    const sent: string[] = []
    const store = paintStore()
    const id = elementId("1.1")
    const value = [
      {
        from: 0,
        runs: [
          { from: 0, text: "Hello " },
          { from: 1, text: "world" },
        ],
      },
    ]
    await show(store, id, writeTextValue(value))
    const { host } = await render(createElement(Passage, { store, id, onEdit: (next) => void sent.push(next) }))
    const editor = editorIn(host)
    const world = runText(editor, 1)
    caretAt(world, 2)
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
    await act(async () => {
      editor.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)
    expect(sent.map((text) => readTextValue(text))).toEqual([
      [
        {
          from: 0,
          runs: [
            { from: 0, text: "Hello " },
            { from: 1, text: "wo" },
          ],
        },
        { from: 0, runs: [{ from: 1, text: "rld" }] },
      ],
    ])
    expect(editor.querySelectorAll("[data-paragraph]").length).toBe(2)
  })

  async function mountValue(value: TextValue) {
    const sent: string[] = []
    const store = paintStore()
    const id = elementId("1.1")
    await show(store, id, writeTextValue(value))
    const { host } = await render(createElement(Passage, { store, id, onEdit: (next) => void sent.push(next) }))
    return { sent, store, id, editor: editorIn(host) }
  }

  async function press(editor: HTMLElement, key: string): Promise<boolean> {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    await act(async () => {
      editor.dispatchEvent(event)
    })
    return event.defaultPrevented
  }

  async function input(editor: HTMLElement): Promise<void> {
    await act(async () => {
      editor.dispatchEvent(new InputEvent("input", { bubbles: true }))
    })
  }

  const twoRuns = [
    {
      from: 0,
      runs: [
        { from: 0, text: "Hello " },
        { from: 1, text: "world" },
      ],
    },
  ]

  it("the caret stays at the start of the new paragraph and an echo of the split keeps it", async () => {
    const { sent, store, id, editor } = await mountValue(twoRuns)
    caretAt(runText(editor, 1), 2)
    await press(editor, "Enter")
    const tail = runText(editor, 2)
    expect(tail.nodeValue).toBe("rld")
    const selection = window.getSelection()
    expect(selection?.getRangeAt(0).startContainer).toBe(tail)
    expect(selection?.getRangeAt(0).startOffset).toBe(0)

    await show(store, id, sent[0] ?? "")
    expect(runText(editor, 2)).toBe(tail)
    expect(selection?.getRangeAt(0).startContainer).toBe(tail)
    expect(selection?.getRangeAt(0).startOffset).toBe(0)
  })

  it("typing inside a run keeps the run's from", async () => {
    const { sent, editor } = await mountValue(twoRuns)
    const world = runText(editor, 1)
    world.nodeValue = "wor!ld"
    caretAt(world, 4)
    await input(editor)
    expect(sent.map((text) => readTextValue(text))).toEqual([
      [
        {
          from: 0,
          runs: [
            { from: 0, text: "Hello " },
            { from: 1, text: "wor!ld" },
          ],
        },
      ],
    ])
  })

  it("Backspace at the start of a paragraph joins it to the one before", async () => {
    const { sent, editor } = await mountValue(twoRuns)
    caretAt(runText(editor, 1), 2)
    await press(editor, "Enter")
    caretAt(runText(editor, 2), 0)
    expect(await press(editor, "Backspace")).toBe(true)
    expect(readTextValue(sent.at(-1) ?? "")).toEqual(twoRuns)
    expect(editor.querySelectorAll("[data-paragraph]").length).toBe(1)
    expect(window.getSelection()?.getRangeAt(0).startContainer).toBe(runText(editor, 1))
    expect(window.getSelection()?.getRangeAt(0).startOffset).toBe(2)
  })

  it("a joined paragraph from another source paragraph writes its runs as new", async () => {
    const { sent, editor } = await mountValue([
      { from: 0, runs: [{ from: 0, text: "one" }] },
      { from: 1, runs: [{ from: 0, text: "two" }] },
    ])
    caretAt(runText(editor, 1), 0)
    await press(editor, "Backspace")
    expect(readTextValue(sent.at(-1) ?? "")).toEqual([
      {
        from: 0,
        runs: [
          { from: 0, text: "one" },
          { from: -1, text: "two" },
        ],
      },
    ])
  })

  it("Backspace inside a paragraph is left to the browser", async () => {
    const { sent, editor } = await mountValue(twoRuns)
    caretAt(runText(editor, 1), 2)
    expect(await press(editor, "Backspace")).toBe(false)
    expect(sent).toEqual([])
  })

  it("typing into an empty box writes a first run that is new", async () => {
    const { sent, editor } = await mountValue([{ from: 0, runs: [] }])
    const paragraph = editor.querySelector("[data-paragraph]")
    if (paragraph === null) throw new Error("missing paragraph")
    paragraph.replaceChildren("Hi")
    await input(editor)
    expect(sent.map((text) => readTextValue(text))).toEqual([[{ from: 0, runs: [{ from: -1, text: "Hi" }] }]])
  })

  it("a pasted line break becomes a paragraph break", async () => {
    const { sent, editor } = await mountValue(twoRuns)
    caretAt(runText(editor, 0), 5)
    const event = new Event("paste", { bubbles: true, cancelable: true })
    Object.defineProperty(event, "clipboardData", { value: { getData: () => "A\r\nB" } })
    await act(async () => {
      editor.dispatchEvent(event)
    })
    expect(readTextValue(sent.at(-1) ?? "")).toEqual([
      { from: 0, runs: [{ from: 0, text: "HelloA" }] },
      {
        from: 0,
        runs: [
          { from: 0, text: "B " },
          { from: 1, text: "world" },
        ],
      },
    ])
  })

  it("a stored plain string is one paragraph with one run", async () => {
    const store = paintStore()
    const id = elementId("1.1")
    await show(store, id, "Hello")
    const sent: string[] = []
    const { host } = await render(createElement(Passage, { store, id, onEdit: (next) => void sent.push(next) }))
    const editor = editorIn(host)
    const node = runText(editor, 0)
    node.nodeValue = "Hello!"
    caretAt(node, 6)
    await input(editor)
    expect(sent.map((text) => readTextValue(text))).toEqual([[{ from: 0, runs: [{ from: 0, text: "Hello!" }] }]])
  })

  it("typing over a selection of the whole box keeps the first run's from", async () => {
    const { sent, editor } = await mountValue(twoRuns)
    editor.focus()
    const selection = window.getSelection()
    const range = document.createRange()
    range.setStart(runText(editor, 0), 0)
    range.setEnd(runText(editor, 1), 5)
    selection?.removeAllRanges()
    selection?.addRange(range)
    const event = new InputEvent("beforeinput", { inputType: "insertText", data: "X", bubbles: true, cancelable: true })
    await act(async () => {
      editor.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)
    expect(sent.map((text) => readTextValue(text))).toEqual([[{ from: 0, runs: [{ from: 0, text: "X" }] }]])
    expect(selection?.getRangeAt(0).startOffset).toBe(1)
  })
})
