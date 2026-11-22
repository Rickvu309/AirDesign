import { describe, expect, it } from "vitest"
import { insertsFirst, type ToolbarTools } from "@/editor/toolbar-tools"

describe("toolbar tools", () => {
  it("runs the first step before every insert and passes each insert's choice through", () => {
    const calls: string[] = []
    const tools: ToolbarTools = {
      panel: "agent",
      onText: () => calls.push("text"),
      onPicture: (file) => calls.push(`picture ${file.name}`),
      onShape: (geometry) => calls.push(`shape ${geometry}`),
      onIcon: (name) => calls.push(`icon ${name}`),
    }
    const first = insertsFirst(tools, () => calls.push("first"))
    first.onText?.()
    first.onPicture?.(new File([], "logo.png"))
    first.onShape?.("rect")
    first.onIcon?.("rocket")
    expect(calls).toEqual(["first", "text", "first", "picture logo.png", "first", "shape rect", "first", "icon rocket"])
    expect(first.panel).toBe("agent")
  })

  it("adds no insert the view did not offer", () => {
    const first = insertsFirst({ panel: "none" }, () => undefined)
    expect(Object.keys(first)).toEqual(["panel"])
  })
})
