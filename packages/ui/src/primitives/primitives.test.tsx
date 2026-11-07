import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { NavItem, Tooltip } from "./primitives.tsx"
import { Icon } from "../index.ts"

let root: Root | null = null

afterEach(() => {
  act(() => root?.unmount())
  root = null
  document.body.innerHTML = ""
})

function render(children: ReactNode) {
  const host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
  act(() => root?.render(children))
}

describe("shell navigation", () => {
  it.each([["Recents", "/"], ["All decks", "/?browse=all"], ["Trash", "/trash"], ["Settings", "/settings/usage"]])("renders %s as a native link", (label, href) => {
    const onSelect = vi.fn()
    render(<NavItem label={label} href={href} icon="decks" selected onSelect={onSelect}/>)
    const link = document.querySelector("a")
    expect(link?.getAttribute("href")).toBe(href)
    expect(link?.getAttribute("aria-current")).toBe("page")
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    act(() => link?.dispatchEvent(click))
    expect(click.defaultPrevented).toBe(true)
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }])("preserves native modified navigation %j", (options) => {
    const onSelect = vi.fn()
    render(<NavItem label="All decks" href="/?browse=all" icon="decks" selected={false} onSelect={onSelect}/>)
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, ...options })
    act(() => document.querySelector("a")?.dispatchEvent(click))
    expect(click.defaultPrevented).toBe(false)
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe("tooltip", () => {
  it("describes the trigger and retains its existing description", () => {
    render(<Tooltip label="Deck help"><button type="button" aria-describedby="existing">Help</button></Tooltip>)
    const trigger = document.querySelector("button")
    const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]')
    expect(trigger?.getAttribute("aria-describedby")?.split(" ")).toEqual(["existing", tooltip?.id])
  })

  it("does not add a tab stop around the trigger", () => {
    render(<Tooltip label="Deck help"><button type="button">Help</button></Tooltip>)
    expect(document.querySelector(".ad-tooltip")?.hasAttribute("tabindex")).toBe(false)
  })

  it("dismisses on Escape while retaining focus and reopens on the next focus", () => {
    render(<Tooltip label="Deck help"><button type="button">Help</button></Tooltip>)
    const trigger = document.querySelector("button")
    const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]')
    act(() => trigger?.focus())
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })))
    expect(tooltip?.hidden).toBe(true)
    expect(document.activeElement).toBe(trigger)
    act(() => trigger?.blur())
    act(() => trigger?.focus())
    expect(tooltip?.hidden).toBe(false)
  })
})


describe("shared editor icons", () => {
  it.each(["undo", "redo"] as const)("preserves the %s glyph through the public UI export", name => {
    render(<Icon name={name}/>)
    const icon = document.querySelector("svg")
    expect(icon?.getAttribute("data-icon")).toBe(name)
    expect(icon?.getAttribute("stroke-width")).toBe("1.5")
    expect(icon?.getAttribute("aria-hidden")).toBe("true")
    expect(icon?.querySelector("path")?.getAttribute("d")).toBeTruthy()
  })
})
