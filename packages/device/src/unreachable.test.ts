import { describe, expect, it } from "vitest"
import { openTab, reach, timeoutMs, type Tab } from "./index.js"

function opened(tab: Tab | null): Tab {
  if (tab === null) {
    throw new Error("closed")
  }
  return tab
}

describe("reach", () => {
  it("no open tab", () => {
    const tab = opened(openTab({ presence: "absent", elapsedMs: -1, version: 1.5, authority: -1 }))
    expect(tab).toEqual({ presence: "absent" })
    expect(reach(tab)).toBe("no-open-tab")
  })

  it("hidden tab", () => {
    const tab = opened(openTab({ presence: "hidden", elapsedMs: 0, version: 1, authority: 1 }))
    expect(tab).toEqual({ presence: "hidden", elapsedMs: 0, version: 1, authority: 1 })
    expect(reach(tab)).toBe("tab-hidden")
  })

  it("hidden tab stays hidden", () => {
    const tab = opened(openTab({ presence: "hidden", elapsedMs: 60000, version: 2, authority: 1 }))
    expect(tab).toEqual({ presence: "hidden", elapsedMs: 60000, version: 2, authority: 1 })
    expect(reach(tab)).toBe("tab-hidden")
  })

  it("visible tab times out", () => {
    expect(timeoutMs).toBe(30000)
    const late = opened(openTab({ presence: "visible", elapsedMs: 30000, version: 4, authority: 9 }))
    expect(reach(late)).toBe("tab-timeout")
    const inside = opened(openTab({ presence: "visible", elapsedMs: 29999, version: 4, authority: 4 }))
    expect(reach(inside)).toBe("ready")
  })

  it("visible tab is outdated", () => {
    const tab = opened(openTab({ presence: "visible", elapsedMs: 0, version: 2, authority: 1 }))
    expect(reach(tab)).toBe("tab-outdated")
  })

  it("visible tab is ready", () => {
    const tab = opened(openTab({ presence: "visible", elapsedMs: 29999, version: 7, authority: 7 }))
    expect(reach(tab)).toBe("ready")
  })

  it("bad clock is refused", () => {
    const refused = [
      openTab({ presence: "visible", elapsedMs: -1, version: 0, authority: 0 }),
      openTab({ presence: "visible", elapsedMs: Number.NaN, version: 0, authority: 0 }),
      openTab({ presence: "visible", elapsedMs: 0, version: 1.5, authority: 0 }),
      openTab({ presence: "visible", elapsedMs: 0, version: 0, authority: -1 }),
    ]
    expect(refused).toEqual([null, null, null, null])
  })
})
