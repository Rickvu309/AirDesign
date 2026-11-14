import type { Kind } from "@airdesign/document"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { designCopy } from "@/copy/design-copy"
import { controlViews } from "@/design/control-views"
import type { ControlKind, ControlProps, PanelModel, PanelRow, Swatch as PaletteSwatch } from "@/design/panel"
import { haldenMist, haldenTeal, swatchMist, swatchNavy, swatchTeal, swatchWhite } from "@/editor/design-panel-art"
import { EditorIcon } from "@/editor/editor-icons"
import { cn } from "@/lib/class-names"

export function DesignPanel() {
  return (
    <>
      <DesignHead>Slide 3</DesignHead>
      <DesignSection title="Template">
        <div className="flex items-center gap-3 rounded-[var(--shape-card)] bg-white p-2 shadow-[0px_0px_0px_1px_var(--field-edge)]">
          <span className="flex h-10 w-10 shrink-0 overflow-hidden rounded-[var(--shape-control)]">
            <span className="block flex-1 bg-navy" />
            <span className="block flex-1" style={{ backgroundColor: haldenTeal }} />
            <span className="block flex-1" style={{ backgroundColor: haldenMist }} />
          </span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-[length:var(--type-dense)] font-medium text-foreground">Halden</span>
            <span className="text-xs text-faint">Geist</span>
          </span>
          <EditorIcon name="chev" size={14} className="text-faint" />
        </div>
      </DesignSection>
      <DesignSection title="Background">
        <BackgroundKind>
          <span className="flex h-7 flex-1 items-center justify-center text-xs text-quiet">Image</span>
        </BackgroundKind>
        <Swatch color={swatchWhite} name="White" edged />
      </DesignSection>
      <DesignSection title="Colors" last>
        <div className="grid grid-cols-2 gap-2">
          <Swatch color={swatchNavy} name="Navy" />
          <Swatch color={swatchTeal} name="Teal" />
          <Swatch color={swatchMist} name="Mist" />
          <Swatch color={swatchWhite} name="White" edged />
        </div>
      </DesignSection>
    </>
  )
}

export function DesignHead({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-12 shrink-0 items-center border-b border-line px-4">
      <span className="text-sm font-semibold text-foreground">{children}</span>
    </div>
  )
}

export function DesignSection({
  title,
  id,
  last = false,
  children,
}: {
  title: string
  id?: string
  last?: boolean
  children: ReactNode
}) {
  return (
    <section className={cn("flex flex-col gap-3 px-4 py-4", last ? null : "border-b border-line")}>
      <h2 id={id} className="text-[length:var(--type-dense)] font-semibold text-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function BackgroundKind({ color = "Color", children }: { color?: string; children: ReactNode }) {
  return (
    <div className="flex h-8 items-center rounded-lg bg-line p-0.5">
      <span className="flex h-7 flex-1 items-center justify-center rounded-[var(--shape-control)] bg-white text-xs font-medium text-foreground shadow-[0px_1px_2px_var(--black-10)]">
        {color}
      </span>
      {children}
    </div>
  )
}

const swatchShape = "flex h-9 items-center gap-2.5 rounded-lg bg-white px-3 shadow-[0px_0px_0px_1px_var(--field-edge)]"

function Chip({ color, edged }: { color: string; edged: boolean }) {
  return (
    <span
      className={
        edged ? "size-4 shrink-0 rounded-sm shadow-[0px_0px_0px_1px_var(--field-edge)]" : "size-4 shrink-0 rounded-sm"
      }
      style={{ background: color }}
    />
  )
}

export function Swatch({ color, name, edged = false }: { color: string; name: string; edged?: boolean }) {
  return (
    <span className={swatchShape} data-design-swatch>
      <Chip color={color} edged={edged} />
      <span className="truncate text-[length:var(--type-dense)] text-foreground">{name}</span>
    </span>
  )
}

export function SwatchButton({
  color,
  name,
  edged,
  pressed,
  onPick,
}: {
  color: string
  name: string
  edged: boolean
  pressed: boolean
  onPick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-pressed={pressed}
      onClick={onPick}
      className={cn(
        swatchShape,
        "h-9 justify-start border-0 font-normal hover:bg-white active:translate-y-0",
        pressed ? "shadow-[0_0_0_2px_var(--ring)]" : null,
      )}
    >
      <Chip color={color} edged={edged} />
      <span className="truncate text-[length:var(--type-dense)] text-foreground">{name}</span>
    </Button>
  )
}

type Run = { readonly control: ControlKind; readonly rows: readonly PanelRow[] }

const paired: readonly ControlKind[] = ["length", "toggle"]

function runsOf(rows: readonly PanelRow[]): readonly Run[] {
  const runs: Run[] = []
  for (const row of rows) {
    const last = runs.at(-1)
    if (last !== undefined && last.control === row.control && paired.includes(row.control))
      runs[runs.length - 1] = { ...last, rows: [...last.rows, row] }
    else runs.push({ control: row.control, rows: [row] })
  }
  return runs
}

function RowView({ row, palette, onChange }: ControlProps) {
  const View = controlViews[row.control]
  return View === undefined ? null : <View row={row} palette={palette} onChange={onChange} />
}

export function ElementDesign({
  model,
  kind,
  palette,
  onChange,
}: {
  model: PanelModel
  kind: Kind
  palette: readonly PaletteSwatch[]
  onChange: (row: PanelRow, value: unknown) => void
}) {
  const last = model.sections.length - 1
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-y-auto outline-none"
      data-design-panel
      data-design-element={model.node}
      data-keeps-selection
      tabIndex={-1}
    >
      <DesignHead>{designCopy.kinds[kind]}</DesignHead>
      {model.sections.length === 0 ? (
        <p className="px-4 py-4 text-[length:var(--type-dense)] text-quiet">{designCopy.nothing}</p>
      ) : null}
      {model.sections.map((section, at) => (
        <DesignSection key={section.trait} title={section.label} last={at === last}>
          {runsOf(section.rows).map((run) => (
            <div
              key={run.rows.map((row) => row.field).join(" ")}
              className={
                run.control === "length"
                  ? "grid grid-cols-2 gap-2"
                  : run.control === "toggle"
                    ? "grid grid-cols-3 gap-2"
                    : "flex flex-col"
              }
            >
              {run.rows.map((row) => (
                <RowView key={row.field} row={row} palette={palette} onChange={(value) => onChange(row, value)} />
              ))}
            </div>
          ))}
        </DesignSection>
      ))}
    </div>
  )
}
