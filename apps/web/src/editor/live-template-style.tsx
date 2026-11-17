import { useState } from "react"
import {
  openRegister,
  readSlideId,
  schemeNames,
  slideNode,
  templateNode,
  themeSlots,
  type TemplateStyle,
} from "@airdesign/document"
import { readSlides, slideTheme, templateStyle, templateStyles, templateTextStyles } from "@airdesign/pptx"
import { SlidersVertical, Ellipsis } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { designCopy } from "@/copy/design-copy"
import { themeCopy } from "@/copy/theme-copy"
import { ColorPicker } from "@/design/color-picker"
import { changeDesign } from "@/design/design-change"
import { panelOf } from "@/design/panel"
import { deviceScope } from "@/design/trait-edit"
import { rebasedChange } from "@/design/rebase"
import { DesignSection, SectionStrips } from "@/editor/design-panel"
import type { DesigningDeck } from "@/editor/live-design-panel"
import { TemplateStyleCard } from "@/editor/template-style-card"

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
      template: { id },
    }))
    setChoosing(false)
  }
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
          <SlidersVertical className="size-3.5" />
        </Button>
      }
    >
      <Popover open={choosing} onOpenChange={setChoosing}>
        <PopoverTrigger
          render={<TemplateStyleCard style={style} open={choosing} onOpen={() => setChoosing(!choosing)} />}
        />
        <PopoverContent align="end" aria-label={designCopy.chooseTemplateStyle}>
          {styles.map((choice) => (
            <div key={choice.id} className="flex items-center gap-1">
              <TemplateStyleCard
                style={cardOf(choice)}
                open={false}
                label={choice.name ?? designCopy.currentTheme}
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
                <SlidersVertical />
              </Button>
            </div>
          ))}
        </PopoverContent>
      </Popover>
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
            index={styles.findIndex((style) => style.id === edited.id)}
            onAll={() => apply(edited.id, true)}
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
}: {
  deck: DesigningDeck
  style: TemplateStyle
  index: number
  onAll: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const parts = deck.shown.displayParts.current
  const node = templateNode(index)
  const textStyles = templateTextStyles(parts, style.id)
  const fonts = style.palette.fonts ?? {}
  const view = deviceScope(
    deck.shown.shownParts.current,
    deck.shown.shownRegister.current ?? openRegister("", ""),
  ).view(node)
  const fields = Object.fromEntries(Object.entries(fonts).map(([key, value]) => [`theme.${key}`, { value, own: true }]))
  const section =
    view === undefined
      ? undefined
      : panelOf(view, { reads: {}, moves: false, fields }).sections.find((section) => section.trait === "theme")
  const strips =
    section?.strips.filter((strip) =>
      strip.some((control) => control.field === "major" || control.field === "minor"),
    ) ?? []
  return (
    <DialogContent data-design-theme>
      <div className="flex items-center gap-2 pr-8">
        <DialogTitle className="min-w-0 flex-1 truncate">{style.name ?? designCopy.currentTheme}</DialogTitle>
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
              changeDesign(deck, () => ({ target: { node }, theme: { name } }))
              setRenaming(false)
            }
          }}
        />
      ) : null}
      <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
        <section className="flex flex-col gap-3">
          <h3 className="font-medium">{designCopy.templateTextStyles}</h3>
          <p className="text-xs text-muted-foreground">{designCopy.templateReadOnly}</p>
          {textStyles.map((text) => (
            <div key={text.role}>
              <div className="text-lg" style={{ fontFamily: text.font ?? undefined }}>
                {designCopy.templateStyleRole[text.role]}
              </div>
              <div className="text-xs text-muted-foreground">
                {text.size === null
                  ? text.font
                  : designCopy.templateFontSize(text.font ?? designCopy.themeFontsMissing, text.size)}
              </div>
            </div>
          ))}
        </section>
        <section className="flex flex-col gap-3">
          <h3 className="font-medium">{designCopy.templateColors}</h3>
          <div className="grid grid-cols-6 gap-2">
            {themeSlots.flatMap((slot) => {
              const hex = style.palette.slots[slot]
              return hex === undefined
                ? []
                : [
                    <ColorPicker
                      key={slot}
                      title={themeCopy[slot]}
                      value={{ rgb: hex }}
                      palette={{ theme: [], deck: [] }}
                      theme={false}
                      onPick={(color) => {
                        if ("rgb" in color)
                          changeDesign(deck, () => ({ target: { node }, theme: { [slot]: color.rgb } }))
                      }}
                      children={null}
                      trigger={
                        <Button
                          variant="outline"
                          className="size-9"
                          aria-label={themeCopy[slot]}
                          title={`${themeCopy[slot]} #${hex}`}
                          style={{ backgroundColor: `#${hex}` }}
                        />
                      }
                    />,
                  ]
            })}
          </div>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="font-medium">{designCopy.templateFonts}</h3>
          <SectionStrips
            strips={strips}
            palette={{ theme: [], deck: [] }}
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
