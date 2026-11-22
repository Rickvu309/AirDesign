import type { scene } from "@airdesign/document"
import { Segmented, NumberField, PanelSection } from "./panel-fields"
import { PaintList } from "./paint-list"
import type { PanelContext } from "./design-parts"
import { shownOf } from "./panel-model"
import { propOf } from "./node-props"
import { plainStroke, setEach, strokeWrites } from "./panel-writes"
import { sceneEditorCopy } from "@/copy/scene-editor-copy"

export function FillsSection({ ids, view, theme, push }: PanelContext) {
  const fills = shownOf(view, ids, "fills")
  return (
    <PanelSection title={sceneEditorCopy.fills} name="fills">
      <PaintList
        label={sceneEditorCopy.fills}
        paints={fills.value ?? []}
        mixed={fills.mixed}
        theme={theme}
        onChange={(paints) => push(setEach(ids, "fills", paints.length === 0 ? null : paints))}
      />
    </PanelSection>
  )
}

const aligns = [
  { value: "inside", label: sceneEditorCopy.strokeInside },
  { value: "center", label: sceneEditorCopy.strokeCenter },
  { value: "outside", label: sceneEditorCopy.strokeOutside },
] as const

const dashes = [
  { value: "solid", label: sceneEditorCopy.dashSolid },
  { value: "dash", label: sceneEditorCopy.dashDash },
  { value: "dot", label: sceneEditorCopy.dashDot },
] as const

export function StrokesSection({ ids, view, theme, push }: PanelContext) {
  const strokes = shownOf(view, ids, "strokes")
  const style = shownOf(view, ids, "stroke")
  const now = style.value ?? plainStroke
  const paints = strokes.value ?? []
  return (
    <PanelSection title={sceneEditorCopy.strokes} name="strokes">
      <PaintList
        label={sceneEditorCopy.strokes}
        paints={paints}
        mixed={strokes.mixed}
        theme={theme}
        solidOnly
        onChange={(next) => {
          const first = paints.length === 0 && next.length > 0
          push([
            ...setEach(ids, "strokes", next.length === 0 ? null : next),
            ...(first
              ? ids
                  .filter((id) => propOf(view.nodes.get(id), "stroke") === undefined)
                  .flatMap((id) => strokeWrites(view, [id], {}))
              : []),
          ])
        }}
      />
      {paints.length === 0 ? null : (
        <>
          <NumberField
            label={sceneEditorCopy.weight}
            value={now.weight}
            mixed={style.mixed}
            min={0}
            step={0.5}
            onCommit={(weight) => push(strokeWrites(view, ids, { weight }))}
          />
          <Segmented
            label={sceneEditorCopy.alignment}
            value={style.mixed ? undefined : now.align}
            options={aligns}
            onChange={(align) => push(strokeWrites(view, ids, { align }))}
          />
          <Segmented
            label={sceneEditorCopy.strokes}
            value={style.mixed ? undefined : now.dash}
            options={dashes}
            onChange={(dash) => push(strokeWrites(view, ids, { dash }))}
          />
        </>
      )}
    </PanelSection>
  )
}

const effects = [
  { value: "none", label: sceneEditorCopy.effectNone },
  { value: "soft", label: sceneEditorCopy.effectSoft },
  { value: "lifted", label: sceneEditorCopy.effectLifted },
  { value: "glow", label: sceneEditorCopy.effectGlow },
] as const

export function EffectsSection({ ids, view, push }: PanelContext) {
  const shown = shownOf(view, ids, "effects")
  const name = typeof shown.value === "string" ? shown.value : shown.value === undefined ? "none" : undefined
  return (
    <PanelSection title={sceneEditorCopy.effects} name="effects">
      <div role="group" aria-label={sceneEditorCopy.effects} className="grid grid-cols-2 gap-1">
        {effects.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={!shown.mixed && name === option.value}
            onClick={() =>
              push(setEach(ids, "effects", option.value === "none" ? null : (option.value as scene.EffectStyleName)))
            }
            className="h-7 rounded-md bg-muted px-2 text-left text-[length:var(--type-caption)] whitespace-nowrap aria-pressed:bg-white aria-pressed:shadow-[0_0_0_1px_var(--primary-strong)]"
          >
            {option.label}
          </button>
        ))}
      </div>
    </PanelSection>
  )
}
