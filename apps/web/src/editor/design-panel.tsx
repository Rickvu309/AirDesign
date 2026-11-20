import { Fragment, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { designCopy } from "@/copy/design-copy"
import { colorCopy } from "@/copy/color-copy"
import { FillDetails, UnionControl } from "@/design/controls/union"
import { controlViews } from "@/design/control-views"
import { BlurControl, OverlayControl } from "@/design/controls/picture-adjust"
import type { Palette } from "@/design/color-choices"
import type { ControlProps, PanelModel, PanelControl, PanelSection } from "@/design/panel"
import { visibleEffects } from "@/design/effects-list"
import { panelPlaces, sectionInMode, type PanelMode } from "@/design/panel-order"
import { foldOpen, setFold, useFolds } from "@/design/panel-folds"
import { swatchMist, swatchNavy, swatchTeal, swatchWhite } from "@/editor/design-panel-art"
import { EditorIcon } from "@/editor/editor-icons"
import { optionWord } from "@/copy/option-copy"
import { cn } from "@/lib/class-names"
import { LinkFormatting } from "@/design/controls/link"
import { isWeight, selectedWeight, useSelectedWeight, weightPicked } from "@/design/selected-weight"
import type { TextFormatting } from "@airdesign/render"
import { linkCopy } from "@/copy/link-copy"
import { followsDrag, useLiveBoxControl } from "@/editor/live-box-fields"

const openChrome = ["text", "link", "fills", "textFill", "border", "shadow", "opacity"]

export function DesignPanel() {
  return (
    <>
      <DesignHead>Slide 3</DesignHead>
      <DesignSection title="Background">
        <Swatch color={swatchWhite} name="White" edged />
      </DesignSection>
      <DesignSection title={colorCopy.template} last>
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
      <span className="text-[length:var(--panel-title-size)] font-medium text-foreground">{children}</span>
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

const swatchShape =
  "flex h-7 items-center gap-2 rounded-[var(--shape-control)] bg-white px-2 shadow-[0px_0px_0px_1px_var(--field-edge)]"

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
      <span className="truncate text-[length:var(--type-caption)] text-foreground">{name}</span>
    </span>
  )
}

export function ControlView(props: ControlProps) {
  return followsDrag(props.control) ? <LiveBoxControl {...props} /> : shownControl(props)
}

function LiveBoxControl(props: ControlProps) {
  return shownControl({ ...props, control: useLiveBoxControl(props.control) })
}

function shownControl({ control, palette, onChange }: ControlProps): ReactNode {
  if (control.field.startsWith("kept."))
    return <p className="text-[length:var(--type-caption)] text-quiet">{control.label}</p>
  if (control.trait === "image" && control.field === "overlay")
    return <OverlayControl control={control} palette={palette} onChange={onChange} />
  if (control.trait === "image" && control.field === "blur")
    return <BlurControl control={control} palette={palette} onChange={onChange} />
  const View = controlViews[control.kind]
  return View === undefined ? null : (
    <View control={control} palette={palette} onChange={onChange} inner={ControlView} />
  )
}

function stripColumns(strip: readonly PanelControl[]): string {
  if (strip[0]?.trait === "layout" && strip[0].field !== "padding")
    return `repeat(${strip.length}, minmax(0, 1fr)) var(--control-dense)`
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

function panelTitle({ kind, nodes, sections, frame }: PanelModel): string {
  if (kind === "frame" && frame === "auto") return designCopy.autoFrame
  if (kind === "shape") {
    const shape = sections
      .flatMap((section) => section.strips.flat())
      .find((control) => control.trait === "geometry" && control.field === "shape")?.value
    if (typeof shape === "object" && shape !== null && "preset" in shape && typeof shape.preset === "string")
      return shape.preset === "rect" ? designCopy.square : optionWord("shape.preset", shape.preset)
  }
  if (kind === "text" || kind === "picture") return designCopy.titles[kind]
  if (kind === "many") return designCopy.selected(nodes.length)
  return kind === null ? designCopy.panels.kept : designCopy.panels[kind]
}

export function ElementDesign({
  model: whole,
  palette,
  onChange: changeWhole,
  picture = null,
  titleActions,
  afterTitle = null,
  formatting,
  afterAlignment = null,
  children = null,
  selectionColors = null,
  mode = "slides",
}: {
  formatting?: TextFormatting
  model: PanelModel
  picture?: ReactNode
  titleActions?: ReactNode
  afterTitle?: ReactNode
  afterAlignment?: ReactNode
  children?: ReactNode
  selectionColors?: ReactNode
  mode?: PanelMode
  palette: Palette
  onChange: (control: PanelControl, value: unknown) => void
}) {
  const folds = useFolds()
  const selected = useSelectedWeight(formatting, whole.node)
  const model = selectedWeight(whole, selected)
  const onChange = (control: PanelControl, value: unknown) => {
    if (selected !== null && isWeight(control) && weightPicked(formatting, value)) return
    changeWhole(control, value)
  }
  const { kind } = model
  const fill = model.sections
    .find((section) => section.trait === "fills")
    ?.strips.flat()
    .find((control) => control.kind === "union")
  const sections =
    kind === null
      ? model.sections
      : panelPlaces(kind, mode, model.selectionKinds).flatMap<PanelSection | "selectionColors">(({ section }) => {
          if (section === "selectionColors") return selectionColors === null ? [] : [section]
          const modelSection = model.sections.find(({ trait }) => trait === section)
          if (modelSection === undefined) return []
          const placed = sectionInMode(modelSection, mode)
          return [placed.trait === "effects" ? visibleEffects(placed) : placed]
        })
  const fillDetails = mode === "design" && fill !== undefined && kind !== "picture"
  const last = sections.length - 1
  return (
    <LinkFormatting.Provider value={formatting}>
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
              {panelTitle(model)}
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
              <DesignSection
                key={section.trait}
                title={section.label}
                last={at === last && children === null && !fillDetails}
              >
                {fill === undefined ? null : (
                  <UnionControl control={fill} palette={palette} onChange={(value) => onChange(fill, value)} />
                )}
                {picture}
                <SectionStrips strips={section.strips} palette={palette} onChange={onChange} />
              </DesignSection>
            )
          if (section.label === null)
            return (
              <div key={section.trait} data-design-alignment>
                <DesignSection title={null}>
                  <SectionStrips strips={section.strips} palette={palette} onChange={onChange} />
                </DesignSection>
                <DesignHead actions={titleActions} ruled={afterTitle === null}>
                  {panelTitle(model)}
                </DesignHead>
                {afterAlignment}
                {afterTitle}
              </div>
            )
          const [strip, ...more] = section.strips
          const [lone, ...beside] = strip ?? []
          if (
            section.open &&
            lone !== undefined &&
            more.length === 0 &&
            beside.length === 0 &&
            lone.look.name.show === "beside"
          )
            return (
              <section
                key={section.trait}
                data-design-section={section.label}
                className={cn(
                  "grid grid-cols-2 items-center gap-2 px-4 py-3",
                  at === last && !fillDetails && children === null ? null : "border-b border-line",
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
              last={at === last && children === null && !fillDetails}
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
                kind === null || (section.open && openChrome.includes(section.trait))
                  ? null
                  : {
                      open: foldOpen(folds, kind, section.trait, section.open),
                      onOpen: (open) => setFold(kind, section.trait, open),
                    }
              }
            >
              {(section.trait === "fills" || section.trait === "boxFill") &&
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
        {children}
        {fillDetails && fill !== undefined ? (
          <DesignSection
            title={designCopy.fillDetails}
            mark="data-fill-details"
            last={children === null}
            fold={{
              open: kind !== null && foldOpen(folds, kind, "fillDetails", false),
              onOpen: (open) => {
                if (kind !== null) setFold(kind, "fillDetails", open)
              },
            }}
          >
            <FillDetails control={fill} palette={palette} onChange={(value) => onChange(fill, value)} />
          </DesignSection>
        ) : null}
      </div>
    </LinkFormatting.Provider>
  )
}
