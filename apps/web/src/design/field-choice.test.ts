import { traitNames, traits, type Desc } from "@airdesign/document"
import { expect, it } from "vitest"
import { optionWord } from "@/copy/option-copy"
import { choiceLayout } from "./field-looks"

function choices(desc: Desc, field: string): readonly (readonly [string, readonly string[]])[] {
  switch (desc.kind) {
    case "choice":
      return [[field, desc.options]]
    case "record":
      return Object.entries(desc.fields).flatMap(([name, item]) => choices(item, `${field}.${name}`))
    case "union":
      return Object.entries(desc.cases).flatMap(([name, item]) => choices(item, `${field}.${name}`))
    default:
      return []
  }
}

it("names autofit's choices in PowerPoint's words", () => {
  expect(["none", "shrink", "grow"].map((option) => optionWord("autofit", option))).toEqual([
    "Do not Autofit",
    "Shrink text on overflow",
    "Resize shape to fit text",
  ])
})

it("lists autofit's choices, since its words are too long for a segment", () => {
  expect(choiceLayout("autofit", ["none", "shrink", "grow"])).toBe("list")
})

it("keeps short choices as segments and long lists as a list", () => {
  expect(choiceLayout("anchor", ["t", "ctr", "b"])).toBe("segments")
  expect(choiceLayout("vertical", ["horz", "vert", "vert270"])).toBe("segments")
  expect(choiceLayout("dash", ["solid", "dot", "dash", "lgDash", "dashDot"])).toBe("list")
})

it("puts every segmented word inside its segment", () => {
  const segmented = traitNames.flatMap((trait) =>
    [...Object.entries(traits[trait].fields), ...Object.entries(traits[trait].inputs)].flatMap(([field, kind]) =>
      choices((kind as { readonly desc: Desc }).desc, field).filter(
        ([name, options]) => choiceLayout(name, options) !== "list",
      ),
    ),
  )
  expect(segmented.length).toBeGreaterThan(0)
  for (const [field, options] of segmented)
    for (const option of options) expect(optionWord(field, option).length).toBeLessThanOrEqual(12)
})
