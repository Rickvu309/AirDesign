import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import type { PanelControl } from "@/design/panel"
import { pictureCopy } from "@/copy/picture-copy"
import { nodeModel } from "./design-model"
import { built, idOf, slide, type Probe } from "@/testing/agent-reach"

const modelOf = (name: Probe) =>
  nodeModel({ view: built.view, id: idOf(name), theme: doom.defaultTheme, slides: [slide] })

const controlsOf = (name: Probe): readonly PanelControl[] =>
  modelOf(name).sections.flatMap((section) => section.strips.flat())

describe("a picture's panel", () => {
  it("carries no icon search and no second block beside its fills", () => {
    expect(controlsOf("photo").some((control) => control.field === "source")).toBe(false)
    expect(modelOf("photo").sections.map((section) => section.trait)).not.toContain("image")
  })

  it("names the fit menu Fill mode, as Figma does", () => {
    const mode = controlsOf("photo").find((control) => control.trait === "image" && control.field === "mode")
    expect(mode?.label).toBe(pictureCopy.mode)
    expect(mode?.look.name.show).toBe("above")
  })
})
