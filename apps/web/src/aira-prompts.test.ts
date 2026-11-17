import { elementId, slideId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { adjustToneCopy as words } from "./copy/adjust-tone-copy"
import { requestedTone, tonePrompt, type ToneScope } from "./aira-prompts"

const slide = slideId("256")
const first = elementId("256.2")
const second = elementId("256.3")
const group = elementId("256.4")

describe("Adjust tone requests", () => {
  it("recognizes a scoped dial request after selection order changes", () => {
    const scope: ToneScope = { slide, selection: [first, second], text: [first, second] }
    const point = { column: 2, row: 0 } as const
    const asked = tonePrompt(scope, point)
    expect(asked).toContain(`${words.professional}, ${words.expanded}`)
    expect(requestedTone({ ...scope, selection: [second, first] }, asked)).toEqual(point)
    expect(requestedTone({ ...scope, selection: [first] }, asked)).toBeUndefined()
    expect(requestedTone({ ...scope, selection: [] }, asked)).toBeUndefined()
  })

  it("names the group's text elements explicitly and recognizes its preset", () => {
    const scope: ToneScope = { slide, selection: [group], text: [first, second] }
    const preset = words.presets[1]
    const asked = tonePrompt(scope, preset)
    expect(asked).toContain(`only these editable text elements: ${first}, ${second}`)
    expect(requestedTone(scope, asked)).toBe(preset)
    expect(requestedTone({ ...scope, selection: [first, second] }, asked)).toBeUndefined()
  })
})
