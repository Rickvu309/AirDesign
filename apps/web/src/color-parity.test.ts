import { readAgent, traitWire } from "@airdesign/catalog"
import {
  alphaOf,
  fadedColor,
  readColor,
  slotted,
  traitNames,
  traits,
  type Color,
  type Desc,
  type TraitName,
} from "@airdesign/document"
import { exportParts, themeSwatches } from "@airdesign/pptx"
import { beforeAll, describe, expect, it } from "vitest"
import { templateColorColumns, typedColor, type Swatch } from "./design/color-choices"
import { namedByColor } from "./design/color-names"
import { ensureMarkup } from "./markup"
import { deckParts, indexed, painted, panelRegister, placed, type At, type Parts } from "./parity-probe"
import { probes } from "./trait-probes"

const hash = "#"

type Loose = {
  readonly deck: string
  readonly kind: Parameters<typeof placed>[1]
  readonly node?: string
  readonly fields: Readonly<
    Record<
      string,
      | {
          file: (parts: Parts, at: At) => unknown
          shows: (value: unknown) => unknown
          on?: { readonly deck: string; readonly kind: Parameters<typeof placed>[1]; readonly node: string }
        }
      | undefined
    >
  >
}

type Wire = { readonly fields?: Readonly<Record<string, { readonly example: unknown } | undefined>> }

type Landed = { readonly field: string; readonly color: string; readonly landed: boolean }

function colored(desc: Desc): boolean {
  switch (desc.kind) {
    case "color":
      return true
    case "union":
      return Object.values(desc.cases).some(colored)
    case "record":
      return Object.values(desc.fields).some(colored)
    case "list":
    case "named":
      return colored(desc.item)
    default:
      return false
  }
}

function recolored(value: unknown, color: Color): unknown {
  if (Array.isArray(value)) return value.map((each) => recolored(each, color))
  if (typeof value !== "object" || value === null) return value
  const held = readColor(value)
  if (held !== null && held !== undefined) return fadedColor(color, alphaOf(held))
  return Object.fromEntries(Object.entries(value).map(([key, each]) => [key, recolored(each, color)]))
}

function personColors(templateColors: readonly Swatch[]): Readonly<Record<string, Color | null>> {
  const columns = templateColorColumns(templateColors)
  const accent = columns.find((column) => "scheme" in column.swatch.color && column.swatch.color.scheme === "accent1")
  const tinted = columns
    .flatMap((column) => column.shades)
    .find((shade) => shade.color.transforms?.some((each) => each.op === "lumOff") === true)
  return {
    "template color": accent?.swatch.color ?? null,
    "template tint": tinted?.color ?? null,
    hex: typedColor(`${hash}1F4E79`),
  }
}

function colorFields(trait: TraitName): readonly (readonly [string, Desc, boolean])[] {
  const loose = (shown: object) => Object.entries(shown as Readonly<Record<string, { readonly desc: Desc }>>)
  return [
    ...loose(traits[trait].fields)
      .filter(([field]) => !slotted(trait, field))
      .map(([field, kind]) => [field, kind.desc, false] as const),
    ...loose(traits[trait].inputs).map(
      ([field, kind]) => [field, kind.desc, traits[trait].slots.length === 0] as const,
    ),
  ].filter(([, desc]) => colored(desc))
}

async function landings(): Promise<readonly Landed[]> {
  const found: Landed[] = []
  for (const trait of traitNames) {
    const probe = probes[trait] as unknown as Loose
    const wire = traitWire[trait] as Wire
    for (const [field, desc, input] of colorFields(trait)) {
      const sent = (wire.fields?.[field]?.example as Readonly<Record<string, Readonly<Record<string, unknown>>>>)?.[
        trait
      ]?.[field]
      const read = readAgent(desc, sent)
      const on = probe.fields[field]?.on ?? probe
      const parts = await deckParts(on.deck)
      const at = placed(parts, on.kind, on.node)
      const templateColors = namedByColor(themeSwatches(parts, at.part))
      for (const [name, color] of Object.entries(personColors(templateColors))) {
        const value = read.ok && color !== null ? recolored(read.value, color) : undefined
        const register = value === undefined ? null : panelRegister(indexed(parts), at, trait, field, value, parts)
        const exported = register === null ? null : exportParts(parts, register)
        const shape = probe.fields[field]
        const shown =
          exported !== null &&
          (input || shape === undefined
            ? painted(exported, at) !== painted(parts, at)
            : JSON.stringify(shape.file(exported, at)) === JSON.stringify(shape.shows(value)))
        found.push({ field: `${trait}.${field}`, color: name, landed: shown })
      }
    }
  }
  return found
}

let found: readonly Landed[] = []

beforeAll(async () => {
  await ensureMarkup()
  found = await landings()
}, 120_000)

describe("a person reaches every colour an agent can send", () => {
  it("lands a template color, a template tint and a hex colour from the picker in every colour field", () => {
    expect(found.length).toBeGreaterThanOrEqual(15)
    expect(found.filter((each) => !each.landed)).toEqual([])
  })

  it("offers a tint written as the slot with lumMod and lumOff, so it follows a template color change", () => {
    const templateColors = namedByColor([{ scheme: "accent1" as const, css: "4472C4" }])
    expect(personColors(templateColors)["template tint"]).toEqual({
      scheme: "accent1",
      transforms: [
        { op: "lumMod", val: 20_000 },
        { op: "lumOff", val: 80_000 },
      ],
    })
  })
})
