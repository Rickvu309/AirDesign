import { traits, type Desc, type LayoutGuide } from "@airdesign/document"
import { Columns3, Eye, EyeOff, Grid3x3, Minus, Plus, Rows3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { designCopy } from "@/copy/design-copy"
import { guideCopy } from "@/copy/guide-copy"
import type { DesigningDeck } from "@/editor/live-design-panel"
import { resolveControl } from "@/design/panel-arrangement"
import type { Palette } from "@/design/color-choices"
import type { PanelControl } from "@/design/panel"
import { ControlView, DesignSection } from "@/editor/design-panel"
import { changeLayoutGuides, slideGuides } from "@/editor/slide-guides"

const emuPerPoint = 12_700

export const firstLayoutGuide: LayoutGuide = {
  pattern: "grid",
  count: 5,
  align: "stretch",
  size: 10 * emuPerPoint,
  offset: 0,
  gutter: 20 * emuPerPoint,
  color: "FF0000",
  opacity: 10,
  shown: true,
}

const icons = { grid: Grid3x3, columns: Columns3, rows: Rows3 } as const

const iconButton = "h-6 w-6 shrink-0 p-0 text-[var(--panel-icon)] hover:text-foreground active:translate-y-0"

const fields = (
  traits.guides.fields.layout.desc as { readonly item: { readonly fields: Readonly<Record<string, Desc>> } }
).item.fields

function pointsLabel(emu: number): string {
  return `${String(Math.round((emu / emuPerPoint) * 10) / 10)} ${designCopy.points}`
}

export function layoutGuideName(guide: LayoutGuide): string {
  return guideCopy.named(guide.pattern, guide.count, pointsLabel(guide.size))
}

type Part = keyof LayoutGuide

function partControl(
  guide: LayoutGuide,
  part: Part,
  label: string,
  choices?: Readonly<Record<string, string>>,
): PanelControl {
  const desc = fields[part]
  if (desc === undefined) throw new Error("layout guide")
  return resolveControl({
    trait: "guides",
    field: `layout.${part}`,
    label,
    desc,
    value: guide[part],
    mixed: false,
    inherited: false,
    reset: null,
    ...(choices === undefined
      ? {}
      : { choices: Object.entries(choices).map(([value, shown]) => ({ value, label: shown })) }),
    change: () => ({ target: { nodes: [] } }),
  })
}

function listed(control: PanelControl): PanelControl {
  return { ...control, look: { ...control.look, form: "list" } }
}

function settingsOf(guide: LayoutGuide): readonly (readonly PanelControl[])[] {
  const pattern = partControl(guide, "pattern", guideCopy.pattern, guideCopy.patterns)
  const opacity = partControl(guide, "opacity", guideCopy.opacity)
  const tone = [
    partControl(guide, "color", guideCopy.color),
    { ...opacity, kind: "length" as const, look: { ...opacity.look, unit: "%" } },
  ]
  if (guide.pattern === "grid") return [[pattern], [partControl(guide, "size", guideCopy.size)], tone]
  const columns = guide.pattern === "columns"
  const types = columns ? guideCopy.columnTypes : guideCopy.rowTypes
  const sized =
    guide.align === "stretch" ? [] : [partControl(guide, "size", columns ? guideCopy.width : guideCopy.height)]
  const placed =
    guide.align === "center"
      ? []
      : [partControl(guide, "offset", guide.align === "stretch" ? guideCopy.margin : guideCopy.offset)]
  return [
    [pattern],
    [listed(partControl(guide, "align", guideCopy.type, types))],
    [partControl(guide, "count", guideCopy.count), partControl(guide, "gutter", guideCopy.gutter)],
    [...sized, ...placed],
    tone,
  ]
}

function LayoutGuideRow(props: {
  readonly guide: LayoutGuide
  readonly palette: Palette
  readonly onChange: (next: LayoutGuide | null) => void
}) {
  const { guide, palette, onChange } = props
  const name = layoutGuideName(guide)
  const Icon = icons[guide.pattern]
  return (
    <li className="flex h-7 items-center gap-1" data-layout-guide-row={guide.pattern}>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              aria-label={guideCopy.settings(name)}
              title={guideCopy.settings(name)}
              className={iconButton}
            />
          }
        >
          <Icon size={14} className="size-3.5" strokeWidth={1.5} aria-hidden />
        </PopoverTrigger>
        <PopoverContent
          side="left"
          align="start"
          className="flex w-[240px] flex-col gap-2 p-3"
          data-layout-guide-settings
        >
          <span className="text-[length:var(--type-caption)] font-medium text-foreground">{guideCopy.layoutGuide}</span>
          {settingsOf(guide).map((strip) => (
            <div
              key={strip.map((control) => control.field).join(" ")}
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${String(strip.length)}, minmax(0, 1fr))` }}
            >
              {strip.map((control) => (
                <div key={control.field}>
                  <ControlView
                    control={control}
                    palette={palette}
                    onChange={(value) => onChange({ ...guide, [control.field.slice("layout.".length)]: value })}
                  />
                </div>
              ))}
            </div>
          ))}
        </PopoverContent>
      </Popover>
      <span className="min-w-0 flex-1 truncate text-[length:var(--type-caption)] text-foreground">{name}</span>
      <Button
        type="button"
        variant="ghost"
        aria-label={guide.shown ? guideCopy.hide(name) : guideCopy.show(name)}
        title={guide.shown ? guideCopy.hide(name) : guideCopy.show(name)}
        aria-pressed={!guide.shown}
        className={iconButton}
        onClick={() => onChange({ ...guide, shown: !guide.shown })}
      >
        {guide.shown ? (
          <Eye size={14} className="size-3.5" strokeWidth={1.5} aria-hidden />
        ) : (
          <EyeOff size={14} className="size-3.5" strokeWidth={1.5} aria-hidden />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        aria-label={guideCopy.remove(name)}
        title={guideCopy.remove(name)}
        className={iconButton}
        onClick={() => onChange(null)}
      >
        <Minus size={14} className="size-3.5" strokeWidth={1.5} aria-hidden />
      </Button>
    </li>
  )
}

export function LiveLayoutGuides({ deck, palette }: { readonly deck: DesigningDeck; readonly palette: Palette }) {
  const { shown } = deck
  const index = shown.current
  const guides = slideGuides(shown.displayParts.current, index).layoutGuides
  const set = (next: readonly LayoutGuide[]) => changeLayoutGuides(deck, index, next)
  return (
    <DesignSection
      title={guideCopy.layoutGuide}
      action={
        <Button
          type="button"
          variant="ghost"
          aria-label={guideCopy.add}
          title={guideCopy.add}
          className={iconButton}
          onClick={() => set([...guides, firstLayoutGuide])}
        >
          <Plus size={16} className="size-4" aria-hidden />
        </Button>
      }
    >
      {guides.length === 0 ? null : (
        <ul className="-my-1 flex flex-col" aria-label={guideCopy.layoutGuides}>
          {guides.map((guide, at) => (
            <LayoutGuideRow
              key={at}
              guide={guide}
              palette={palette}
              onChange={(next) =>
                set(
                  next === null
                    ? guides.filter((_, each) => each !== at)
                    : guides.map((each, place) => (place === at ? next : each)),
                )
              }
            />
          ))}
        </ul>
      )}
    </DesignSection>
  )
}
