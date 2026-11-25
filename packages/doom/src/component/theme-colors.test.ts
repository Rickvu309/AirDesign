import { expect, it } from "vitest"
import { isRefusal, measureWith, themeLibrary } from "../index.js"
import { expandComponent } from "./index.js"
import { componentLibrary, donutComponent } from "./library.js"
import type { ComponentSpec } from "./spec.js"

const specs: readonly (readonly [string, ComponentSpec])[] = [
  ...[...componentLibrary.values()].map(({ id, spec }) => [id, spec] as const),
  ["donut", donutComponent],
]

const variantsOf = (spec: ComponentSpec): readonly Record<string, unknown>[] => [
  {},
  ...Object.entries(spec.variants ?? {}).flatMap(([name, choices]) =>
    (choices as readonly unknown[]).map((choice) => ({ [name]: choice })),
  ),
]

function rawColours(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value.flatMap(rawColours)
  if (value === null || typeof value !== "object") return []
  return Object.entries(value).flatMap(([key, inner]) =>
    key === "color" && typeof inner === "string" ? [inner] : rawColours(inner),
  )
}

const cases = Object.values(themeLibrary).flatMap(({ id, theme }) =>
  specs.map(([component, spec]) => [component, id, spec, theme] as const),
)

it.each(cases)("paints %s in %s with theme colours only", (_component, _theme, spec, theme) => {
  const sample = spec.sample!
  for (const variant of variantsOf(spec)) {
    const tree = expandComponent(spec, {
      frame: { x: 0, y: 0, w: sample.w, h: sample.h },
      theme,
      measure: measureWith({}),
      data: sample.data,
      variant,
    })
    if (isRefusal(tree)) throw new Error(JSON.stringify(tree))
    const raw = tree.children.flatMap(({ key, props }) =>
      rawColours([props.fills, props.strokes]).map((hex) => `${key.join("/")} ${hex}`),
    )
    expect(raw, JSON.stringify(variant)).toEqual([])
  }
})
