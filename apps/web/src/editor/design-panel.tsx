import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { designCopy } from "@/copy/design-copy"
import { controlViews } from "@/design/control-views"
import type { Palette } from "@/design/color-choices"
import type { ControlProps, PanelModel, PanelControl } from "@/design/panel"
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
    <div className="flex h-10 shrink-0 items-center border-b border-line px-4">
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
  title: string | null
  id?: string
  last?: boolean
  action?: ReactNode
  fold?: Fold | null
  children: ReactNode
}) {
  const edge = last ? null : "border-b border-line"
  if (fold !== null && title !== null)
    return (
      <FoldedSection title={title} edge={edge} action={action} fold={fold}>
        {children}
      </FoldedSection>
    )
  const heading =
    title === null ? null : (
      <h2 id={id} className="text-[length:var(--type-dense)] font-semibold text-foreground">
        {title}
      </h2>
    )
  return (
    <section className={cn("flex flex-col gap-2.5 px-3 py-3", edge)}>
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
      className={cn("flex flex-col gap-2.5 px-3", fold.open ? "py-3" : "py-1.5", edge)}
      data-design-section={title}
    >
      <div className="relative flex min-h-6 items-center">
        <h2 className="min-w-0 flex-1 text-[length:var(--type-dense)] font-semibold text-foreground">
          <CollapsibleTrigger className="group/fold -mx-1 flex w-[calc(100%+0.5rem)] items-center gap-1.5 rounded-[var(--shape-control)] px-1 py-1 text-left">
            <span className="truncate">{title}</span>
            <EditorIcon
              name="chevr"
              size={12}
              strokeWidth={2}
              className="ml-auto shrink-0 text-faint [transition:transform_var(--ease-micro)] group-data-[panel-open]/fold:rotate-90"
            />
          </CollapsibleTrigger>
        </h2>
        {fold.open && action !== null ? <div className="absolute right-5 flex items-center">{action}</div> : null}
      </div>
      <CollapsibleContent className="flex flex-col gap-2.5">{children}</CollapsibleContent>
    </Collapsible>
  )
}

function SectionReset({
  control,
  onChange,
}: {
  control: PanelControl
  onChange: (control: PanelControl, value: unknown) => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      data-section-reset
      className="-my-1 h-6 px-1.5 text-[length:var(--type-caption)] font-normal text-quiet hover:text-foreground active:translate-y-0"
      onClick={() => onChange(control, null)}
    >
      {control.reset}
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

function ControlView({ control, palette, onChange }: ControlProps) {
  const View = controlViews[control.kind]
  return View === undefined ? null : (
    <View control={control} palette={palette} onChange={onChange} inner={ControlView} />
  )
}

export function SectionStrips({
  strips,
  palette,
  onChange,
}: {
  strips: readonly (readonly PanelControl[])[]
  palette: Palette
  onChange: (control: PanelControl, value: unknown) => void
}) {
  return strips.map((strip) => (
    <div
      key={strip.map((control) => control.field).join(" ")}
      className="grid items-end gap-2"
      style={{
        gridTemplateColumns: strip.every((control) => control.kind === "action")
          ? strip
              .map((control) => `${String(control.desc.kind === "choice" ? control.desc.options.length : 1)}fr`)
              .join(" ")
          : `repeat(${strip.length}, minmax(0, 1fr))`,
      }}
    >
      {strip.map((control) => (
        <ControlView
          key={control.field}
          control={control}
          palette={palette}
          onChange={(value) => onChange(control, value)}
        />
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
  onChange: (control: PanelControl, value: unknown) => void
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
      {model.sections.every((section) => section.label !== null) ? <DesignHead>{panelTitle(model)}</DesignHead> : null}
      {model.sections.length === 0 ? (
        <p className="px-4 py-4 text-[length:var(--type-dense)] text-quiet">{designCopy.nothing}</p>
      ) : null}
      {model.sections.map((section, at) => {
        if (section.label === null)
          return (
            <div key={section.trait}>
              <DesignSection title={null}>
                <SectionStrips strips={section.strips} palette={palette} onChange={onChange} />
              </DesignSection>
              <DesignHead>{panelTitle(model)}</DesignHead>
            </div>
          )
        const [strip, ...more] = section.strips
        const [lone, ...beside] = strip ?? []
        if (lone !== undefined && more.length === 0 && beside.length === 0 && lone.look.name.show === "beside")
          return (
            <section
              key={section.trait}
              className={cn(
                "grid grid-cols-2 items-center gap-2 px-3 py-3",
                at === last ? null : "border-b border-line",
              )}
            >
              <h2 className="text-[length:var(--type-dense)] font-semibold text-foreground">{section.label}</h2>
              <ControlView control={lone} palette={palette} onChange={(value) => onChange(lone, value)} />
            </section>
          )
        const reset = section.strips
          .flat()
          .find((control) => control.reset !== null && control.look.name.show === "hidden")
        return (
          <DesignSection
            key={section.trait}
            title={section.label}
            last={at === last}
            action={reset === undefined ? null : <SectionReset control={reset} onChange={onChange} />}
            fold={
              kind === null
                ? null
                : {
                    open: foldOpen(folds, kind, section.trait, section.open),
                    onOpen: (open) => setFold(kind, section.trait, open),
                  }
            }
          >
            <SectionStrips strips={section.strips} palette={palette} onChange={onChange} />
          </DesignSection>
        )
      })}
    </div>
  )
}
