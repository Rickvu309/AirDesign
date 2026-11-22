import { traitNames, traits, type Desc } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { controlKinds, controlOf } from "./design/panel-arrangement"
import { controlViews } from "./design/control-views"

type Loose = Readonly<Record<string, { readonly desc: Desc }>>

const specs = Object.keys(import.meta.glob("../../../tests/browser/control-*.spec.ts")).map(
  (path) => /control-([a-z]+)\.spec\.ts$/.exec(path)?.[1] ?? path,
)

function inside(desc: Desc): readonly Desc[] {
  if (desc.kind === "union") return Object.values(desc.cases).flatMap((item) => [item, ...inside(item)])
  if (desc.kind === "record") return Object.values(desc.fields).flatMap((item) => [item, ...inside(item)])
  if (desc.kind === "list" || desc.kind === "named") return [desc.item, ...inside(desc.item)]
  return []
}

function kindsInUse(): readonly string[] {
  const descs = traitNames
    .flatMap((trait) => [
      ...Object.values(traits[trait].fields as Loose),
      ...Object.values(traits[trait].inputs as Loose),
    ])
    .flatMap((kind) => [kind.desc, ...inside(kind.desc)])
    .filter((desc) => desc.kind !== "alpha" && desc.kind !== "mark")
  return [...new Set(descs.map(controlOf).filter((kind) => kind !== null))].sort()
}

describe("every control kind a field uses", () => {
  it("has one component and one browser spec of its name, inside a union, a record or a list too", () => {
    const used = kindsInUse()
    expect(used.filter((kind) => !Object.hasOwn(controlViews, kind))).toEqual([])
    expect(used.filter((kind) => !specs.includes(kind))).toEqual([])
  })

  it("has one component and one browser spec of its name for every kind, the action rows too", () => {
    expect(controlKinds.filter((kind) => !Object.hasOwn(controlViews, kind))).toEqual([])
    expect(controlKinds.filter((kind) => !specs.includes(kind))).toEqual([])
  })

  it("names no spec or component for a kind outside the closed list", () => {
    const known: readonly string[] = controlKinds
    expect(specs.filter((kind) => !known.includes(kind))).toEqual([])
    expect(Object.keys(controlViews).filter((kind) => !known.includes(kind))).toEqual([])
  })

  it("maps a length, a type size, a flag, a colour, a choice and words to their controls", () => {
    expect(
      [
        traits.box.fields.x,
        traits.text.inputs.size,
        traits.text.inputs.bold,
        traits.text.inputs.color,
        traits.text.inputs.align,
        traits.notes.fields.value,
      ].map((kind) => controlOf(kind.desc)),
    ).toEqual(["length", "length", "toggle", "color", "choice", "text"])
  })
})
