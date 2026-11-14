import { describe, expect, it } from "vitest"
import { kinds, kindTraits, type FieldKey } from "./index.js"
import {
  fieldKeys,
  inheritable,
  keptRefuses,
  traitNames,
  traits,
  type FieldName,
  type FieldValue,
  type HasAlpha,
  type TraitValue,
  type WireAgent,
  type WireField,
} from "./traits.js"

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Expect<T extends true> = T

export type Derived = [
  Expect<Same<FieldName<"box">, "x" | "y" | "w" | "h">>,
  Expect<Same<FieldValue<"box", "w">, number>>,
  Expect<Same<TraitValue<"notes">, { readonly value: string }>>,
  Expect<Same<FieldName<"fill">, "value">>,
  Expect<Same<FieldName<"line">, never>>,
  Expect<null extends WireAgent<"fill", "value"> ? true : false>,
  Expect<null extends WireAgent<"box", "x"> ? false : true>,
  Expect<"none" | "group" | "accent1" extends WireAgent<"fill", "value"> ? true : false>,
  Expect<Same<WireField<"box">, "x" | "y" | "w" | "h">>,
  Expect<Same<WireAgent<"box", "x">, number>>,
  Expect<Same<WireAgent<"text", "value">, string>>,
  Expect<Same<HasAlpha, false>>,
  Expect<"table.value" extends FieldKey ? true : false>,
  Expect<"fill.value" extends FieldKey ? true : false>,
  Expect<"line.width" extends FieldKey ? false : true>,
]

describe("the one table of traits", () => {
  it("declares the thirteen slots with the rule PowerPoint inherits each by", () => {
    expect(Object.fromEntries(traitNames.map((name) => [name, traits[name].inherits]))).toEqual({
      identity: "own",
      box: "whole",
      geometry: "whole",
      fill: "whole",
      line: "field",
      effects: "whole",
      body: "field",
      text: "run",
      image: "own",
      crop: "own",
      connection: "own",
      table: "own",
      notes: "own",
    })
  })

  it("holds only the fields that are live: the box, the fill, and the text, notes and table values", () => {
    expect(traitNames.flatMap(fieldKeys)).toEqual([
      "box.x",
      "box.y",
      "box.w",
      "box.h",
      "fill.value",
      "text.value",
      "table.value",
      "notes.value",
    ])
  })

  it("lets only a declared field go back to the value its layout, master or style gives", () => {
    const fields = traitNames.flatMap((trait) =>
      Object.keys(traits[trait].fields).flatMap((field) => (inheritable(trait, field) ? [`${trait}.${field}`] : [])),
    )
    expect(fields).toEqual(["fill.value"])
  })

  it("keeps a slot it cannot model from a patch inside it, but lets a whole value replace it", () => {
    expect(keptRefuses(["fill"], "fill", "value")).toBe(false)
    expect(keptRefuses(["geometry"], "geometry", "shape")).toBe(true)
    expect(keptRefuses(["effects.shadow"], "effects", "shadow")).toBe(true)
    expect(keptRefuses(["text.color"], "text", "value")).toBe(false)
    expect(keptRefuses([], "fill", "value")).toBe(false)
  })

  it("gives every kind a closed list of declared traits", () => {
    for (const kind of kinds) for (const trait of kindTraits[kind]) expect(traitNames).toContain(trait)
    expect(kindTraits.group).toEqual(["identity", "box", "effects"])
    expect(kindTraits.slide).toEqual(["notes"])
  })
})
