import type { MarkupElement } from "./element-span.js"
import { paintedDrops } from "./effects-extension.js"
import type { PaintPalette } from "./paint-color.js"
import type { PaintEffects } from "./paint-effects.js"
import type { ShapePaint } from "./paint-shape.js"
import { standRecords } from "./stand-read.js"
import type { MarkupChildren } from "./text-value-route.js"

type StandItem = { readonly shape: string; readonly hidden: boolean; readonly group: string | null }

type Stood<T> = T & { readonly group: string | null; readonly paint: ShapePaint }

export function standPaint<T extends StandItem>(
  elements: readonly MarkupElement[],
  children: MarkupChildren,
  palette: PaintPalette,
  drawn: readonly T[],
  paintOf: (item: T) => ShapePaint,
): readonly Stood<T>[] {
  const stands = standRecords(elements, children)
  const hidden = new Set(stands.filter((record) => record.matched).flatMap((record) => [record.group, record.picture]))
  const matched = new Map(stands.filter((record) => record.matched).map((record) => [record.shape, record]))
  const moved = new Set(stands.filter((record) => !record.matched).map((record) => record.shape))
  const place = (shape: string, group: string | null, effects: PaintEffects | undefined) => {
    const held = matched.get(shape)
    const drops = held === undefined ? undefined : paintedDrops(children, held.stand, palette)
    let next = effects
    if (drops !== undefined && drops.length > 0) next = { ...effects, drops }
    if (held === undefined && moved.has(shape) && next?.drops !== undefined) {
      const { drops: _drops, ...rest } = next
      next = Object.keys(rest).length === 0 ? undefined : rest
    }
    return {
      group: held === undefined ? group : held.parent,
      effects: next,
      replace: held !== undefined || moved.has(shape),
    }
  }
  return drawn.flatMap((item) => {
    if (item.hidden || hidden.has(item.shape)) return []
    const paint = paintOf(item)
    const held = place(item.shape, item.group, paint.effects)
    if (!held.replace) return [{ ...item, group: held.group, paint }]
    const { effects: _effects, ...rest } = paint
    const shown: ShapePaint = held.effects === undefined ? rest : { ...rest, effects: held.effects }
    return [{ ...item, group: held.group, paint: shown }]
  })
}
