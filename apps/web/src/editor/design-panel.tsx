import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { designCopy } from "@/copy/design-copy"
import { controlViews } from "@/design/control-views"
import type { Palette } from "@/design/color-choices"
import type { ControlKind, ControlProps, PanelModel, PanelRow } from "@/design/panel"
import { foldOpen, setFold, useFolds } from "@/design/panel-folds"
import { swatchMist, swatchNavy, swatchTeal, swatchWhite } from "@/editor/design-panel-art"
import { EditorIcon } from "@/editor/editor-icons"
import { cn } from "@/lib/class-names"

export function DesignPanel() {
  return (
    <>
      <DesignHead>Slide 3</DesignHead>
      <DesignSection title="Background">
        <Swatch color={swatchWhite} name="White" edged />
      </DesignSection>
      <DesignSection title="Theme" last>
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

type Fold = { readonly open: boolean; readonly onOpen: (open: boolean) => void }

export function DesignSection({
  title,
  id,
  last = false,
  action = null,
  fold = null,
  children,
}: {
  title: string
  id?: string
  last?: boolean
  action?: ReactNode
  fold?: Fold | null
  children: ReactNode
}) {
  const edge = last ? null : "border-b border-line"
  if (fold !== null)
    return (
      <FoldedSection title={title} edge={edge} action={action} fold={fold}>
        {children}
      </FoldedSection>
    )
  const heading = (
    <h2 id={id} className="text-[length:var(--type-dense)] font-semibold text-foreground">
      {title}
    </h2>
  )
  return (
    <section className={cn("flex flex-col gap-3 px-4 py-4", edge)}>
      {action === null ? (
        heading
      ) : (
        <div className="flex min-h-6 items-center justify-between gap-2">
          {heading}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

function FoldedSection({
  title,
  edge,
  action,
  fold,
  children,
}: {
  title: string
  edge: string | null
  action: ReactNode
  fold: Fold
  children: ReactNode
}) {
  return (
    <Collapsible
      open={fold.open}
      onOpenChange={fold.onOpen}
      render={<section />}
      className={cn("flex flex-col gap-3 px-4", fold.open ? "py-4" : "py-2", edge)}
      data-design-section={title}
    >
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h2 className="min-w-0 flex-1 text-[length:var(--type-dense)] font-semibold text-foreground">
          <CollapsibleTrigger className="group/fold -mx-1 flex w-[calc(100%+0.5rem)] items-center gap-1.5 rounded-[var(--shape-control)] px-1 py-1 text-left">
            <EditorIcon
              name="chevr"
              size={12}
              strokeWidth={2}
              className="shrink-0 text-faint [transition:transform_var(--ease-micro)] group-data-[panel-open]/fold:rotate-90"
            />
            <span className="truncate">{title}</span>
          </CollapsibleTrigger>
        </h2>
        {fold.open ? action : null}
      </div>
      <CollapsibleContent className="flex flex-col gap-3">{children}</CollapsibleContent>
    </Collapsible>
  )
}

function SectionReset({ row, onChange }: { row: PanelRow; onChange: (row: PanelRow, value: unknown) => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      data-section-reset
      className="-my-1 h-6 px-1.5 text-[length:var(--type-caption)] font-normal text-quiet hover:text-foreground active:translate-y-0"
      onClick={() => onChange(row, null)}
    >
      {row.reset}
    </Button>
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

const paired: readonly ControlKind[] = ["length", "toggle", "hex"]

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
  return View === undefined ? null : <View row={row} palette={palette} onChange={onChange} inner={RowView} />
}

export function SectionRows({
  rows,
  palette,
  onChange,
}: {
  rows: readonly PanelRow[]
  palette: Palette
  onChange: (row: PanelRow, value: unknown) => void
}) {
  return runsOf(rows).map((run) => (
    <div
      key={run.rows.map((row) => row.field).join(" ")}
      className={
        run.control === "length" || run.control === "hex"
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
  ))
}

function panelTitle({ kind, nodes }: PanelModel): string {
  if (kind === "many") return designCopy.elements(nodes.length)
  return kind === null ? designCopy.panels.kept : designCopy.panels[kind]
}

export function ElementDesign({
  model,
  palette,
  onChange,
}: {
  model: PanelModel
  palette: Palette
  onChange: (row: PanelRow, value: unknown) => void
}) {
  const last = model.sections.length - 1
  const folds = useFolds()
  const { kind } = model
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-y-auto outline-none"
      data-design-panel
      data-design-element={model.nodes.join(" ")}
      data-keeps-selection
      tabIndex={-1}
    >
      <DesignHead>{panelTitle(model)}</DesignHead>
      {model.sections.length === 0 ? (
        <p className="px-4 py-4 text-[length:var(--type-dense)] text-quiet">{designCopy.nothing}</p>
      ) : null}
      {model.sections.map((section, at) => {
        const reset = section.rows.find((row) => row.reset !== null && !row.caption)
        return (
          <DesignSection
            key={section.trait}
            title={section.label}
            last={at === last}
            action={reset === undefined ? null : <SectionReset row={reset} onChange={onChange} />}
            fold={
              kind === null
                ? null
                : {
                    open: foldOpen(folds, kind, section.trait, section.open),
                    onOpen: (open) => setFold(kind, section.trait, open),
                  }
            }
          >
            <SectionRows rows={section.rows} palette={palette} onChange={onChange} />
          </DesignSection>
        )
      })}
    </div>
  )
}
