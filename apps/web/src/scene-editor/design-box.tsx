import type { scene } from "@airdesign/document"
import { Switch } from "@/components/ui/switch"
import { sceneEditorCopy } from "@/copy/scene-editor-copy"
import type { PanelContext } from "./design-parts"
import { FieldRow, NumberField, PanelSection, Segmented } from "./panel-fields"
import { shownOf } from "./panel-model"
import {
  boxFieldWrites,
  layoutModeWrites,
  layoutPatchWrites,
  opacityWrites,
  setEach,
  sizingWrites,
  type BoxField,
  type LayoutMode,
} from "./panel-writes"
import { propOf } from "./node-props"

export function BoxSection({ ids, view, geometry, push }: PanelContext) {
  const [id] = ids
  const placed = id === undefined ? undefined : geometry.byId.get(id)
  if (id === undefined || placed === undefined) return null
  const stored = propOf(view.nodes.get(id), "box") ?? placed.node.box
  const fields: readonly { readonly field: BoxField; readonly label: string; readonly value: number }[] = [
    { field: "x", label: sceneEditorCopy.fieldX, value: stored.x },
    { field: "y", label: sceneEditorCopy.fieldY, value: stored.y },
    { field: "w", label: sceneEditorCopy.fieldW, value: placed.node.box.w },
    { field: "h", label: sceneEditorCopy.fieldH, value: placed.node.box.h },
    { field: "rotation", label: sceneEditorCopy.fieldRotation, value: stored.rotation },
  ]
  return (
    <PanelSection title={sceneEditorCopy.position} name="box">
      <div className="grid grid-cols-2 gap-2">
        {fields.map(({ field, label, value }) => (
          <NumberField
            key={field}
            label={label}
            value={value}
            onCommit={(next) => push(boxFieldWrites(view, geometry, id, field, next))}
          />
        ))}
      </div>
    </PanelSection>
  )
}

const sizes = [
  { value: "fixed", label: sceneEditorCopy.fixed },
  { value: "hug", label: sceneEditorCopy.hug },
  { value: "fill", label: sceneEditorCopy.fill },
] as const

export function SizingSection({ ids, view, push }: PanelContext) {
  const sizing = shownOf(view, ids, "sizing")
  const now = sizing.value ?? { w: "fixed" as const, h: "fixed" as const }
  return (
    <PanelSection title={sceneEditorCopy.resizing} name="sizing">
      <FieldRow label={sceneEditorCopy.width}>
        <Segmented
          label={sceneEditorCopy.width}
          value={sizing.mixed ? undefined : now.w}
          options={sizes}
          onChange={(mode) => push(sizingWrites(view, ids, { axis: "w", mode }))}
        />
      </FieldRow>
      <FieldRow label={sceneEditorCopy.height}>
        <Segmented
          label={sceneEditorCopy.height}
          value={sizing.mixed ? undefined : now.h}
          options={sizes}
          onChange={(mode) => push(sizingWrites(view, ids, { axis: "h", mode }))}
        />
      </FieldRow>
    </PanelSection>
  )
}

const modes = [
  { value: "none", label: sceneEditorCopy.layoutNone },
  { value: "row", label: sceneEditorCopy.layoutRow },
  { value: "column", label: sceneEditorCopy.layoutColumn },
  { value: "grid", label: sceneEditorCopy.layoutGrid },
] as const

const aligns: readonly scene.Align9[] = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center-center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]

export function LayoutSection({ ids, view, push }: PanelContext) {
  const layout = shownOf(view, ids, "layout")
  const now: scene.Layout = layout.value ?? { mode: "none" }
  const mode: LayoutMode | undefined = layout.mixed ? undefined : now.mode
  return (
    <PanelSection title={sceneEditorCopy.layout} name="layout">
      <Segmented
        label={sceneEditorCopy.layout}
        value={mode}
        options={modes}
        onChange={(next) => push(layoutModeWrites(view, ids, next))}
      />
      {now.mode === "none" || layout.mixed ? null : (
        <>
          <div className="flex flex-col gap-2">
            <NumberField
              label={sceneEditorCopy.gap}
              value={now.gap}
              min={0}
              onCommit={(gap) => push(layoutPatchWrites(view, ids, { gap }))}
            />
            <NumberField
              label={sceneEditorCopy.padding}
              value={now.padding.t}
              min={0}
              onCommit={(padding) => push(layoutPatchWrites(view, ids, { padding }))}
            />
          </div>
          {now.mode === "grid" ? (
            <NumberField
              label={sceneEditorCopy.columns}
              value={now.columns.length}
              min={1}
              max={12}
              onCommit={(columns) => push(layoutPatchWrites(view, ids, { columns }))}
            />
          ) : (
            <div role="group" aria-label={sceneEditorCopy.alignment} className="grid w-20 grid-cols-3 gap-1">
              {aligns.map((align) => (
                <button
                  key={align}
                  type="button"
                  aria-label={align}
                  aria-pressed={now.align === align}
                  onClick={() => push(layoutPatchWrites(view, ids, { align }))}
                  className="flex h-6 items-center justify-center rounded bg-muted"
                >
                  <span
                    className={
                      now.align === align
                        ? "size-2 rounded-full bg-[var(--primary-strong)]"
                        : "size-1 rounded-full bg-[var(--dot)]"
                    }
                  />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </PanelSection>
  )
}

export function AppearanceSection({ ids, view, push }: PanelContext) {
  const opacity = shownOf(view, ids, "opacity")
  const radius = shownOf(view, ids, "radius")
  const clip = shownOf(view, ids, "clip")
  const frames = ids.every((id) => view.nodes.get(id)?.type === "frame")
  const corner = typeof radius.value === "number" ? radius.value : Array.isArray(radius.value) ? radius.value[0] : 0
  return (
    <PanelSection title={sceneEditorCopy.appearance} name="appearance">
      <div className="flex flex-col gap-2">
        <NumberField
          label={sceneEditorCopy.opacity}
          value={Math.round((opacity.value ?? 1) * 100)}
          mixed={opacity.mixed}
          min={0}
          max={100}
          suffix="%"
          onCommit={(percent) => push(opacityWrites(ids, percent))}
        />
        <NumberField
          label={sceneEditorCopy.radius}
          value={corner}
          mixed={radius.mixed}
          min={0}
          onCommit={(next) => push(setEach(ids, "radius", next <= 0 ? null : Math.round(next)))}
        />
      </div>
      {frames ? (
        <label className="flex items-center justify-between text-[length:var(--type-dense)]">
          {sceneEditorCopy.clip}
          <Switch
            aria-label={sceneEditorCopy.clip}
            checked={clip.value === true}
            onCheckedChange={(on) => push(setEach(ids, "clip", on ? true : null))}
          />
        </label>
      ) : null}
    </PanelSection>
  )
}
