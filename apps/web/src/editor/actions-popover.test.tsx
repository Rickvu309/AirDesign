import { act, createElement } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"

const picked = vi.hoisted(() => ({ current: null as ((file: File) => void) | null }))

vi.mock("./picture-picker", () => ({
  pickPicture: (onPicture: (file: File) => void) => {
    picked.current = onPicture
  },
}))

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot
let ActionsPanel: typeof import("./actions-popover").ActionsPanel
let editorCopy: typeof import("@/copy/editor-copy").editorCopy

beforeAll(async () => {
  const module = "jsdom"
  const { JSDOM } = await import(module)
  window = new JSDOM("<!doctype html><html><body></body></html>").window
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    HTMLInputElement: window.HTMLInputElement,
    Element: window.Element,
    Node: window.Node,
    MouseEvent: window.MouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    vi.stubGlobal(name, value)
  createRoot = (await import("react-dom/client")).createRoot
  ActionsPanel = (await import("./actions-popover")).ActionsPanel
  editorCopy = (await import("@/copy/editor-copy")).editorCopy
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

async function openPanel() {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  const run = { icon: vi.fn(), picture: vi.fn(), exportPdf: vi.fn() }
  const finish = vi.fn()
  await act(async () => root.render(createElement(ActionsPanel, { run, finish })))
  const input = host.querySelector("input")
  if (input === null) throw new Error("search")
  const type = (text: string) =>
    act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
      setter?.call(input, text)
      input.dispatchEvent(new window.Event("input", { bubbles: true }))
    })
  const press = (key: string, init: KeyboardEventInit = {}) =>
    act(async () => {
      input.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }))
    })
  const highlighted = () => {
    const named = input.getAttribute("aria-activedescendant")
    return named === null ? null : window.document.getElementById(named)
  }
  const option = (name: string) => {
    const found = [...host.querySelectorAll<HTMLElement>("[role='option']")].find(
      (each) => each.getAttribute("aria-label") === name || each.textContent === name,
    )
    if (found === undefined) throw new Error(name)
    return found
  }
  const hover = (target: HTMLElement) =>
    act(async () => {
      target.dispatchEvent(new window.MouseEvent("mousemove", { bubbles: true }))
    })
  const click = (target: HTMLElement) =>
    act(async () => {
      target.dispatchEvent(new window.MouseEvent("click", { bubbles: true }))
    })
  const showAllIcons = () => {
    const button = [...host.querySelectorAll("button")].find((each) => each.textContent === editorCopy.allIcons)
    if (button === undefined) throw new Error("all icons")
    return click(button)
  }
  return { host, root, run, finish, type, press, input, highlighted, option, hover, click, showAllIcons }
}

it("runs the top match when Enter is pressed in the search", async () => {
  const panel = await openPanel()
  try {
    await panel.type("rocket")
    await panel.press("Enter")
    expect(panel.run.icon).toHaveBeenCalledWith("rocket")
    expect(panel.finish).toHaveBeenCalledTimes(1)
  } finally {
    await act(async () => panel.root.unmount())
  }
})

it("moves the highlight through the results with the arrow keys and runs the highlighted one", async () => {
  const panel = await openPanel()
  try {
    await panel.press("ArrowDown")
    await panel.press("ArrowDown")
    await panel.press("Enter")
    expect(panel.run.exportPdf).toHaveBeenCalledTimes(1)
  } finally {
    await act(async () => panel.root.unmount())
  }
})

it("keeps the highlight on the first result instead of wrapping", async () => {
  const panel = await openPanel()
  try {
    await panel.type("rocket")
    await panel.press("ArrowUp")
    await panel.press("Enter")
    expect(panel.run.icon).toHaveBeenCalledWith("rocket")
  } finally {
    await act(async () => panel.root.unmount())
  }
})

it("does nothing on Enter before anything is typed or picked", async () => {
  const panel = await openPanel()
  try {
    await panel.press("Enter")
    expect(panel.finish).not.toHaveBeenCalled()
  } finally {
    await act(async () => panel.root.unmount())
  }
})

it("finds the Deck row by its group title", async () => {
  const panel = await openPanel()
  try {
    await panel.type("deck")
    await panel.press("Enter")
    expect(panel.run.exportPdf).toHaveBeenCalledTimes(1)
  } finally {
    await act(async () => panel.root.unmount())
  }
})

it("omits the chart insertion group", async () => {
  const panel = await openPanel()
  try {
    expect(panel.host.querySelectorAll("[data-actions-group='charts'] [role='option']").length).toBe(0)
  } finally {
    await act(async () => panel.root.unmount())
  }
})

it.each([
  ["an IME composing in Chrome and Firefox", { isComposing: true }],
  ["an IME composing in Safari", { keyCode: 229 }],
])("leaves Enter to %s instead of running the highlighted action", async (_, init) => {
  const panel = await openPanel()
  try {
    await panel.type("rocket")
    await panel.press("Enter", init)
    expect(panel.finish).not.toHaveBeenCalled()
  } finally {
    await act(async () => panel.root.unmount())
  }
})

it("names the search a combobox whose active descendant is the selected option of its listbox", async () => {
  const panel = await openPanel()
  try {
    await panel.press("ArrowDown")
    await panel.press("ArrowDown")
    const listbox = window.document.getElementById(panel.input.getAttribute("aria-controls") ?? "")
    expect(panel.input.getAttribute("role")).toBe("combobox")
    expect(panel.input.getAttribute("aria-expanded")).toBe("true")
    expect(listbox?.getAttribute("role")).toBe("listbox")
    expect(panel.highlighted()?.getAttribute("role")).toBe("option")
    expect(panel.highlighted()?.textContent).toBe(editorCopy.exportPdf)
    expect(listbox?.querySelectorAll("[aria-selected='true']")).toHaveLength(1)
    expect(listbox?.querySelectorAll("button")).toHaveLength(0)
  } finally {
    await act(async () => panel.root.unmount())
  }
})

it("moves the one highlight to the row under the pointer", async () => {
  const panel = await openPanel()
  try {
    await panel.hover(panel.option(editorCopy.placeImage))
    expect(panel.highlighted()?.textContent).toBe(editorCopy.placeImage)
    expect(panel.host.querySelectorAll("[aria-selected='true']")).toHaveLength(1)
    await panel.press("ArrowDown")
    await panel.press("Enter")
    expect(panel.run.exportPdf).toHaveBeenCalledTimes(1)
  } finally {
    await act(async () => panel.root.unmount())
  }
})

it("offers Place image first and hands the chosen file to the picture insert", async () => {
  const panel = await openPanel()
  try {
    const groups = [...panel.host.querySelectorAll("[data-actions-group]")].map((each) =>
      each.getAttribute("data-actions-group"),
    )
    expect(groups[0]).toBe("image")
    expect(panel.option(editorCopy.placeImage).textContent).toBe(editorCopy.placeImage)
    await panel.type("picture")
    await panel.click(panel.option(editorCopy.placeImage))
    const file = new window.File(["png"], "picture.png", { type: "image/png" })
    picked.current?.(file)
    expect(panel.run.picture).toHaveBeenCalledWith(file)
    expect(panel.finish).toHaveBeenCalledTimes(1)
  } finally {
    await act(async () => panel.root.unmount())
  }
})

it("runs an option on click", async () => {
  const panel = await openPanel()
  try {
    await panel.click(panel.option(editorCopy.exportPdf))
    expect(panel.run.exportPdf).toHaveBeenCalledTimes(1)
  } finally {
    await act(async () => panel.root.unmount())
  }
})

it("walks the icon grid by row with Up and Down and within the row with Left and Right", async () => {
  const panel = await openPanel()
  try {
    await panel.showAllIcons()
    const icons = [...panel.host.querySelectorAll("[data-actions-group='icons'] [role='option']")].map((each) =>
      each.getAttribute("aria-label"),
    )
    await panel.press("ArrowDown")
    expect(panel.highlighted()?.getAttribute("aria-label")).toBe(icons[0])
    await panel.press("ArrowLeft")
    expect(panel.highlighted()?.getAttribute("aria-label")).toBe(icons[0])
    await panel.press("ArrowDown")
    expect(panel.highlighted()?.getAttribute("aria-label")).toBe(icons[8])
    await panel.press("ArrowRight")
    await panel.press("ArrowRight")
    await panel.press("ArrowLeft")
    expect(panel.highlighted()?.getAttribute("aria-label")).toBe(icons[9])
    await panel.press("ArrowUp")
    await panel.press("Enter")
    expect(panel.run.icon).toHaveBeenCalledWith(icons[1])
  } finally {
    await act(async () => panel.root.unmount())
  }
})

it("drops the highlight when All icons swaps the results, so Enter runs nothing the person did not pick", async () => {
  const panel = await openPanel()
  try {
    await panel.type("rocket")
    await panel.showAllIcons()
    expect(panel.highlighted()).toBeNull()
    await panel.press("Enter")
    expect(panel.run.icon).not.toHaveBeenCalled()
    expect(window.document.activeElement).toBe(panel.input)
  } finally {
    await act(async () => panel.root.unmount())
  }
})

it("says Nothing matches in a status region that stays mounted, so a screen reader hears it", async () => {
  const panel = await openPanel()
  try {
    const status = panel.host.querySelector("[role='status']")
    expect(status?.textContent).toBe("")
    await panel.type("zzzzzz")
    expect(panel.host.querySelector("[role='status']")).toBe(status)
    expect(status?.textContent).toBe(editorCopy.noActions)
    await panel.type("rocket")
    expect(status?.textContent).toBe("")
  } finally {
    await act(async () => panel.root.unmount())
  }
})

it("lays the icon grid out in the same number of columns the arrow keys step by", async () => {
  const panel = await openPanel()
  try {
    await panel.showAllIcons()
    const grid = panel.host.querySelector<HTMLElement>("[data-actions-group='icons'] > div")
    const columns = Number(/repeat\((\d+)/.exec(grid?.style.gridTemplateColumns ?? "")?.[1])
    expect(grid?.className).not.toMatch(/grid-cols-/)
    const icons = [...panel.host.querySelectorAll("[data-actions-group='icons'] [role='option']")].map((each) =>
      each.getAttribute("aria-label"),
    )
    await panel.press("ArrowDown")
    await panel.press("ArrowDown")
    expect(panel.highlighted()?.getAttribute("aria-label")).toBe(icons[columns])
  } finally {
    await act(async () => panel.root.unmount())
  }
})
