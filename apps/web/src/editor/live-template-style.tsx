import { useState } from "react"
import {
  openRegister,
  readSlideId,
  schemeNames,
  slideNode,
  templateStyleNode,
  templateColors,
  type TemplateStyle,
} from "@airdesign/document"
import {
  readSlides,
  remixTargets,
  slideTheme,
  templateStyle,
  templateStyles,
  themeCustomColors,
  type ThemeCustomColor,
} from "@airdesign/pptx"
import { EditorIcon } from "@/editor/editor-icons"
import { Ellipsis, Plus, Shuffle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { colorCopy } from "@/copy/color-copy"
import { designCopy } from "@/copy/design-copy"
import { ColorPicker } from "@/design/color-picker"
import { namedByColor } from "@/design/color-names"
import { changeDesign } from "@/design/design-change"
import { panelOf } from "@/design/panel"
import { rebasedChange } from "@/design/rebase"
import { useTextStyleEdit } from "@/design/text-style-edit"
import { deviceScope } from "@/design/trait-edit"
import { DesignSection, SectionStrips } from "@/editor/design-panel"
import type { DesigningDeck } from "@/editor/live-design-panel"
import { listedTextStyles } from "@/editor/text-style-dialog"
import { TemplateStyleCard, TemplateStyleFace } from "@/editor/template-style-card"

function colorName(colors: readonly ThemeCustomColor[]): string {
  const used = new Set(colors.map((color) => color.name))
  let count = colors.length + 1
  while (used.has(`Color ${String(count)}`)) count += 1
  return `Color ${String(count)}`
}

function templatePlace(deck: DesigningDeck, id: string, fallback: number): number {
  const stored = deck.shown.shownRegister.current?.index?.templateStyles
  const found = stored?.findIndex((style) => style.id === id) ?? -1
  return found >= 0 ? found : fallback
}

function cardOf(style: TemplateStyle) {
  return {
    name: style.name,
    major: style.palette.fonts?.major ?? null,
    minor: style.palette.fonts?.minor ?? null,
    swatches: schemeNames.flatMap((scheme) => {
      const hex = style.palette.slots[scheme]
      return hex === undefined ? [] : [{ scheme, css: `#${hex}` }]
    }),
  }
}

export function LiveTemplateStyle({ deck }: { deck: DesigningDeck }) {
  const [choosing, setChoosing] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const parts = deck.shown.displayParts.current
  const slides = readSlides(parts)
  const part = slides[deck.shown.current]?.part
  const current = part === undefined ? null : slideTheme(parts, part)
  const styles = templateStyles(parts)
  const style = part === undefined ? null : templateStyle(parts, part)
  const edited = styles.find((style) => style.id === editing)
  const apply = (id: string, all = false) => {
    changeDesign(deck, () => ({
      target: {
        nodes: slides
          .filter(
            (_, index) =>
              all ||
              (deck.selectedSlides?.includes(deck.shown.current)
                ? deck.selectedSlides.includes(index)
                : index === deck.shown.current),
          )
          .flatMap(({ slide }) => {
            const id = readSlideId(slide)
            return id === undefined ? [] : [slideNode(id, "slide")]
          }),
      },
      templateStyle: { id },
    }))
    setChoosing(false)
  }
  const remixable = part !== undefined && remixTargets(parts, part).length > 0
  if (style === null || current === null) return null
  return (
    <DesignSection
      title={designCopy.templateStyle}
      action={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label={designCopy.editTemplateStyle}
          onClick={() => setEditing(current)}
        >
          <EditorIcon name="styleSliders" size={14} />
        </Button>
      }
    >
      <div className="flex min-w-0 items-center gap-1 rounded border border-line p-2 hover:bg-muted">
        <Popover open={choosing} onOpenChange={setChoosing}>
          <PopoverTrigger
            render={
              <button
                type="button"
                data-template-style
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                aria-label={designCopy.chooseTemplateStyle}
                aria-expanded={choosing}
                onClick={() => setChoosing(!choosing)}
              >
                <TemplateStyleFace style={style} />
              </button>
            }
          />
          <PopoverContent align="end" aria-label={designCopy.chooseTemplateStyle}>
            {styles.map((choice) => (
              <div key={choice.id} className="flex items-center gap-1">
                <TemplateStyleCard
                  style={cardOf(choice)}
                  open={false}
                  label={choice.name ?? designCopy.currentTemplateStyle}
                  onOpen={() => apply(choice.id)}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={designCopy.editTemplateStyle}
                  onClick={() => {
                    setChoosing(false)
                    setEditing(choice.id)
                  }}
                >
                  <EditorIcon name="styleSliders" size={16} />
                </Button>
              </div>
            ))}
          </PopoverContent>
        </Popover>
        {remixable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            aria-label={designCopy.remixTemplateColors}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              if (part === undefined) return
              changeDesign(deck, () => remixTargets(deck.shown.displayParts.current, part))
            }}
          >
            <Shuffle className="size-3.5" />
          </Button>
        ) : null}
      </div>
      <Dialog
        open={edited !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        {edited === undefined ? null : (
          <TemplateStyleDialog
            deck={deck}
            style={edited}
            index={templatePlace(
              deck,
              edited.id,
              styles.findIndex((style) => style.id === edited.id),
            )}
            onAll={() => apply(edited.id, true)}
            onClose={() => setEditing(null)}
          />
        )}
      </Dialog>
    </DesignSection>
  )
}

function TemplateStyleDialog({
  deck,
  style,
  index,
  onAll,
  onClose,
}: {
  deck: DesigningDeck
  style: TemplateStyle
  index: number
  onAll: () => void
  onClose: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const parts = deck.shown.displayParts.current
  const node = templateStyleNode(index)
  const bytes = parts.get(style.id)
  const added = bytes === undefined ? null : themeCustomColors(bytes)
  const used = readSlides(parts).some((slide) => slideTheme(parts, slide.part) === style.id)
  const sole = templateStyles(parts).length < 2
  const replaceAdded = (colors: readonly ThemeCustomColor[]) => {
    changeDesign(deck, () => ({ target: { node }, templateStyle: { custom: colors } }))
  }
  const fonts = style.palette.fonts ?? {}
  const edit = useTextStyleEdit()
  const listed = listedTextStyles(parts, style.id, fonts.major ?? null, fonts.minor ?? null)
  const view = deviceScope(
    deck.shown.shownParts.current,
    deck.shown.shownRegister.current ?? openRegister("", ""),
  ).view(node)
  const fields = Object.fromEntries(
    Object.entries(fonts).map(([key, value]) => [`templateStyle.${key}`, { value, own: true }]),
  )
  const section =
    view === undefined
      ? undefined
      : panelOf(view, { reads: {}, moves: false, fields }).sections.find((section) => section.trait === "templateStyle")
  const strips =
    section?.strips.filter((strip) =>
      strip.some((control) => control.field === "major" || control.field === "minor"),
    ) ?? []
  const colorLabels = new Map(
    namedByColor(
      templateColors.flatMap((slot) => {
        const hex = style.palette.slots[slot]
        return hex === undefined ? [] : [{ slot, css: `#${hex}` }]
      }),
    ).map((entry) => [entry.slot, entry.name]),
  )
  return (
    <DialogContent data-template-style-dialog>
      <div className="flex items-center gap-2 pr-8">
        <DialogTitle className="min-w-0 flex-1 truncate">{style.name ?? designCopy.currentTemplateStyle}</DialogTitle>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={used || sole ? designCopy.templateInUse : designCopy.deleteTemplateStyle}
          title={used || sole ? designCopy.templateInUse : undefined}
          disabled={used || sole}
          onClick={() => {
            changeDesign(deck, () => ({ target: { node }, templateStyle: { removed: true } }))
            onClose()
          }}
        >
          <Trash2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={designCopy.templateMore}
          onClick={() => setRenaming(!renaming)}
        >
          <Ellipsis />
        </Button>
      </div>
      <DialogDescription>{designCopy.templateScope}</DialogDescription>
      {renaming ? (
        <Input
          aria-label={designCopy.renameTemplate}
          defaultValue={style.name ?? ""}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              const name = event.currentTarget.value
              changeDesign(deck, () => ({ target: { node }, templateStyle: { name } }))
              setRenaming(false)
            }
          }}
        />
      ) : null}
      <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
        <section className="flex flex-col gap-3">
          <h3 className="font-medium">{designCopy.templateTextStyles}</h3>
          {listed.map((text) => (
            <button
              key={text.id}
              type="button"
              className="flex w-full flex-col items-start rounded-md px-1 py-1 text-left hover:bg-muted"
              onClick={() => edit?.(text.id)}
            >
              <div className="text-lg" style={{ fontFamily: text.shown }}>
                {text.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {text.points === null ? text.shown : designCopy.templateFontSize(text.shown, text.points)}
              </div>
            </button>
          ))}
        </section>
        <section className="flex flex-col gap-3">
          <h3 className="font-medium">{designCopy.templateColors}</h3>
          <div className="grid grid-cols-6 gap-2">
            {templateColors.flatMap((slot) => {
              const hex = style.palette.slots[slot]
              const label = colorLabels.get(slot) ?? slot
              return hex === undefined
                ? []
                : [
                    <ColorPicker
                      key={slot}
                      title={label}
                      value={{ rgb: hex }}
                      palette={{ templateColors: [], deck: [] }}
                      showTemplateColors={false}
                      onPick={(color) => {
                        if ("rgb" in color)
                          changeDesign(deck, () => ({ target: { node }, templateStyle: { [slot]: color.rgb } }))
                      }}
                      children={null}
                      trigger={
                        <Button
                          variant="outline"
                          className="size-9"
                          aria-label={label}
                          title={`${label} ${colorCopy.hexName(hex)}`}
                          style={{ backgroundColor: `#${hex}` }}
                        />
                      }
                    />,
                  ]
            })}
            {added === null
              ? []
              : added.map((color, at) => (
                  <ColorPicker
                    key={color.name}
                    title={color.name}
                    value={{ rgb: color.color }}
                    palette={{ templateColors: [], deck: [] }}
                    showTemplateColors={false}
                    onPick={(next) => {
                      if ("rgb" in next)
                        replaceAdded(added.map((each, place) => (place === at ? { ...each, color: next.rgb } : each)))
                    }}
                    children={null}
                    trigger={
                      <Button
                        variant="outline"
                        className="size-9"
                        aria-label={color.name}
                        title={`${color.name} ${colorCopy.hexName(color.color)}`}
                        style={{ backgroundColor: `#${color.color}` }}
                      />
                    }
                  />
                ))}
            {added !== null && added.length < 32 ? (
              <ColorPicker
                title={designCopy.addTemplateColor}
                value={undefined}
                palette={{ templateColors: [], deck: [] }}
                showTemplateColors={false}
                onPick={(next) => {
                  if ("rgb" in next) replaceAdded([...added, { name: colorName(added), color: next.rgb }])
                }}
                children={null}
                trigger={
                  <Button variant="outline" className="size-9" aria-label={designCopy.addTemplateColor}>
                    <Plus />
                  </Button>
                }
              />
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{designCopy.addedColorNote}</p>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="font-medium">{designCopy.templateFonts}</h3>
          <SectionStrips
            strips={strips}
            palette={{ templateColors: [], deck: [] }}
            onChange={(control, value) => changeDesign(deck, () => rebasedChange(strips.flat(), control, value))}
          />
        </section>
        <Button variant="outline" onClick={onAll}>
          {designCopy.applyTemplateToAll}
        </Button>
      </div>
    </DialogContent>
  )
}
