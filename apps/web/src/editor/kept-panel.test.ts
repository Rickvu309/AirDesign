import { afterEach, expect, it, vi } from "vitest"
import { keepPanel, keptPanel } from "./kept-panel"

function shelf(): Pick<Storage, "getItem" | "setItem"> {
  const held = new Map<string, string>()
  return {
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => void held.set(key, value),
  }
}

function refusing(): Pick<Storage, "getItem" | "setItem"> {
  const refuse = () => {
    throw new DOMException("refused", "SecurityError")
  }
  return { getItem: refuse, setItem: refuse }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it("keeps the panel for each deck apart and opens a deck it never saw on Agent", () => {
  vi.stubGlobal("localStorage", shelf())
  expect(keptPanel("one")).toBe("agent")
  keepPanel("one", "design")
  expect(keptPanel("one")).toBe("design")
  expect(keptPanel("two")).toBe("agent")
  keepPanel("one", "agent")
  expect(keptPanel("one")).toBe("agent")
})

it("opens on Agent when the stored value is not a panel or the browser refuses storage", () => {
  const kept = shelf()
  kept.setItem("airdesign.panel.one", "settings")
  vi.stubGlobal("localStorage", kept)
  expect(keptPanel("one")).toBe("agent")
  vi.stubGlobal("localStorage", refusing())
  expect(() => keepPanel("one", "design")).not.toThrow()
  expect(keptPanel("one")).toBe("agent")
  vi.stubGlobal("localStorage", undefined)
  expect(keptPanel("one")).toBe("agent")
})
