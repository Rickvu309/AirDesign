import { Fragment, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { designCopy } from "@/copy/design-copy"
import { UnionControl } from "@/design/controls/union"
import { controlViews } from "@/design/control-views"
import type { Palette } from "@/design/color-choices"
import type { ControlProps, PanelModel, PanelControl, PanelSection } from "@/design/panel"
import { panelSections } from "@/design/panel-order"
import { foldOpen, setFold, useFolds } from "@/design/panel-folds"
import { EditorIcon } from "@/components/ui/editor-icons"
import { cn } from "@/lib/class-names"
import { linkCopy } from "@/copy/link-copy"
import { LayerName } from "@/editor/layer-name-edit"
import { panelTitle } from "@/editor/panel-title"

const openChrome = ["text", "link", "fills", "textFill", "border", "shadow", "opacity", "geometry"]

export function DesignHead({
  children,
  actions,
  ruled = true,
}: {
  children: ReactNode
  actions?: ReactNode
  ruled?: boolean
}) {
  return (
    <div
      data-design-head
      className={cn(
        "flex h-[var(--panel-head-height)] shrink-0 items-center justify-between gap-2 px-4",
        ruled ? "border-b border-line" : null,
      )}
    >
      <span className="min-w-0 flex-1 text-[length:var(--panel-title-size)] font-medium text-foreground">
        {children}
      </span>
      {actions}
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
  mark,
  children,
}: {
  title: string | null
  id?: string
  last?: boolean
  action?: ReactNode
  fold?: Fold | null
  mark?: string
  children: ReactNode
}) {
  const edge = last ? null : "border-b border-line"
  if (fold !== null && title !== null)
    return (
      <FoldedSection title={title} edge={edge} action={action} fold={fold} mark={mark}>
        {children}
      </FoldedSection>
    )
  const heading =
    title === null ? null : (
      <h2 id={id} className="text-[length:var(--type-caption)] font-medium text-foreground">
        {title}
      </h2>
    )
  return (
    <section data-design-section={title ?? undefined} className={cn("flex flex-col gap-4 px-4 py-3", edge)}>
      {action === null ? (
        heading
      ) : (
        <div className="flex h-4 items-center justify-between gap-2">
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
  mark,
  children,
}: {
  title: string
  edge: string | null
  action: ReactNode
  fold: Fold
  mark?: string
  children: ReactNode
}) {
  return (
    <Collapsible
      open={fold.open}
      onOpenChange={fold.onOpen}
      render={<section />}
      className={cn("flex flex-col gap-2 px-4", fold.open ? "py-3" : "py-1.5", edge)}
      data-design-section={title}
      {...(mark === undefined ? {} : { [mark]: "" })}
    >
      <div className="relative flex min-h-6 items-center">
        <h2 className="min-w-0 flex-1 text-[length:var(--type-caption)] font-medium text-foreground">
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
      <CollapsibleContent className="flex flex-col gap-2">{children}</CollapsibleContent>
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

export function ControlView({ control, palette, onChange }: ControlProps): ReactNode {
  if (control.field.startsWith("kept."))
    return <p className="text-[length:var(--type-caption)] text-quiet">{control.label}</p>
  const View = controlViews[control.kind]
  return View === undefined ? null : (
    <View control={control} palette={palette} onChange={onChange} inner={ControlView} />
  )
}

function stripColumns(strip: readonly PanelControl[]): string {
  if (strip.some((control) => control.field.startsWith("remove.")))
    return strip.map((control) => (control.field.startsWith("remove.") ? "24px" : "minmax(0, 1fr)")).join(" ")
  if (strip.every((control) => control.kind === "action"))
    return strip
      .map((control) => (control.field === "distribute" || control.field === "add" ? "24px" : "minmax(0, 1fr)"))
      .join(" ")
  const color = strip.findIndex((control) => control.kind === "color")
  if (color !== -1 && strip.length === 2) {
    const wide = "minmax(0, 1.5fr)"
    const rest = "minmax(0, 1fr)"
    return color === 0 ? `${wide} ${rest}` : `${rest} ${wide}`
  }
  return `repeat(${strip.length}, minmax(0, 1fr))`
}

function imageRow(section: PanelSection): number {
  const at = section.strips.findIndex((strip) =>
    strip.some(
      (control) =>
        control.field === "paint" &&
        typeof control.value === "object" &&
        control.value !== null &&
        "image" in control.value,
    ),
  )
  return Math.max(at, 0)
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
  return (
    <div className="flex flex-col gap-2">
      {strips.map((strip, index) => (
        <div
          key={`${String(index)} ${strip.map((control) => control.field).join(" ")}`}
          className="grid items-start gap-2"
          style={{ gridTemplateColumns: stripColumns(strip) }}
        >
          {strip.map((control) => (
            <div key={control.field} className="min-w-0">
              <ControlView control={control} palette={palette} onChange={(value) => onChange(control, value)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function ElementDesign({
  model,
  palette,
  onChange,
  picture = null,
  titleActions,
  afterTitle = null,
  afterAlignment = null,
  children = null,
  selectionColors = null,
  layerName,
  onLayerName,
}: {
  model: PanelModel
  picture?: ReactNode
  titleActions?: ReactNode
  afterTitle?: ReactNode
  afterAlignment?: ReactNode
  children?: ReactNode
  selectionColors?: ReactNode
  palette: Palette
  onChange: (control: PanelControl, value: unknown) => void
  layerName?: string
  onLayerName?: (name: string) => void
}) {
  const folds = useFolds()
  const { kind } = model
  const fill = model.sections
    .find((section) => section.trait === "fills")
    ?.strips.flat()
    .find((control) => control.kind === "union")
  const sections =
    kind === null
      ? model.sections
      : panelSections(kind, model.selectionKinds).flatMap<PanelSection | "selectionColors">((section) => {
          if (section === "selectionColors") return selectionColors === null ? [] : [section]
          const modelSection = model.sections.find(({ trait }) => trait === section)
          return modelSection === undefined ? [] : [modelSection]
        })
  const last = sections.length - 1
  const title =
    layerName !== undefined && onLayerName !== undefined ? (
      <LayerName name={layerName} onRename={onLayerName} />
    ) : (
      panelTitle(model)
    )
  const lead = sections.findIndex((section) => section !== "selectionColors" && section.label === null)
  const childrenFollow = children !== null && lead < 0
  const closes = (at: number) => at === last && !childrenFollow
  return (
    <div
      className="design-panel-chrome flex min-h-0 flex-1 flex-col overflow-y-auto outline-none"
      data-panel-kind={kind}
      data-keeps-format
      data-design-panel
      data-design-element={model.nodes.join(" ")}
      data-keeps-selection
      tabIndex={-1}
    >
      {sections.every((section) => section === "selectionColors" || section.label !== null) ? (
        <>
          <DesignHead actions={titleActions} ruled={afterTitle === null}>
            {title}
          </DesignHead>
          {afterAlignment}
          {afterTitle}
        </>
      ) : null}
      {sections.length === 0 ? (
        <p className="px-4 py-4 text-[length:var(--type-caption)] text-quiet">{designCopy.nothing}</p>
      ) : null}
      {sections.map((section, at) => {
        if (section === "selectionColors") return <Fragment key={section}>{selectionColors}</Fragment>
        if (section.trait === "pictureFill")
          return (
            <DesignSection key={section.trait} title={section.label} last={closes(at)}>
              {fill === undefined ? null : (
                <UnionControl control={fill} palette={palette} onChange={(value) => onChange(fill, value)} />
              )}
              {picture}
              <SectionStrips strips={section.strips} palette={palette} onChange={onChange} />
            </DesignSection>
          )
        if (section.label === null)
          return (
            <Fragment key={section.trait}>
              <div data-design-alignment>
                <DesignSection title={null}>
                  <SectionStrips strips={section.strips} palette={palette} onChange={onChange} />
                </DesignSection>
                <DesignHead actions={titleActions} ruled={afterTitle === null}>
                  {title}
                </DesignHead>
                {afterAlignment}
                {afterTitle}
              </div>
              {at === lead ? children : null}
            </Fragment>
          )
        const [strip, ...more] = section.strips
        const [lone, ...beside] = strip ?? []
        if (lone !== undefined && more.length === 0 && beside.length === 0 && lone.look.name.show === "beside")
          return (
            <section
              key={section.trait}
              data-design-section={section.label}
              className={cn(
                "grid grid-cols-2 items-center gap-2 px-4 py-3",
                closes(at) ? null : "border-b border-line",
              )}
            >
              <h2 className="text-[length:var(--type-caption)] font-medium text-foreground">{section.label}</h2>
              <ControlView control={lone} palette={palette} onChange={(value) => onChange(lone, value)} />
            </section>
          )
        const reset = section.strips
          .flat()
          .find((control) => control.reset !== null && control.look.name.show === "hidden")
        return (
          <DesignSection
            key={section.trait}
            title={section.trait === "text" && kind === "text" ? null : section.label}
            last={closes(at)}
            action={
              section.trait === "link" ? (
                <button
                  type="button"
                  aria-label={linkCopy.create}
                  onClick={(event) => event.currentTarget.closest("section")?.querySelector("input")?.focus()}
                >
                  <EditorIcon name="link" size={14} />
                </button>
              ) : null
            }
            fold={
              kind === null || openChrome.includes(section.trait)
                ? null
                : {
                    open: foldOpen(folds, kind, section.trait),
                    onOpen: (open) => setFold(kind, section.trait, open),
                  }
            }
          >
            {section.trait === "fills" &&
            section.strips.some((row) => row.some((control) => control.trait === "image")) ? (
              <>
                <SectionStrips
                  strips={section.strips.slice(0, imageRow(section) + 1)}
                  palette={palette}
                  onChange={onChange}
                />
                {picture}
                <SectionStrips
                  strips={section.strips.slice(imageRow(section) + 1)}
                  palette={palette}
                  onChange={onChange}
                />
              </>
            ) : (
              <SectionStrips strips={section.strips} palette={palette} onChange={onChange} />
            )}
            {reset === undefined || section.trait === "fills" ? null : (
              <SectionReset control={reset} onChange={onChange} />
            )}
          </DesignSection>
        )
      })}
      {lead < 0 ? children : null}
    </div>
  )
}
