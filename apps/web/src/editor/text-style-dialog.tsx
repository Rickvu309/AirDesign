import { useRef, useState, type ReactNode } from "react"
import { templateStyleNode, type ElementId } from "@airdesign/document"
import { masterTextStyles, readSlides, slideTextStyles, slideTheme, templateStyles } from "@airdesign/pptx"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { designCopy } from "@/copy/design-copy"
import { textCopy } from "@/copy/text-copy"
import { changeDesign } from "@/design/design-change"
import { TextStyleEditContext } from "@/design/text-style-edit"
import type { DesigningDeck } from "@/editor/live-design-panel"

type Parts = ReadonlyMap<string, Uint8Array>

type ListedTextStyle = {
  readonly id: string
  readonly name: string
  readonly font: string
  readonly shown: string
  readonly points: number | null
  readonly size: number | null
  readonly node: ElementId
}

function shownFont(token: string, major: string | null, minor: string | null): string {
  if (token === "+mj-lt") return major ?? token
  if (token === "+mn-lt") return minor ?? token
  return token
}

export function listedTextStyles(
  parts: Parts,
  styleId: string,
  major: string | null,
  minor: string | null,
): readonly ListedTextStyle[] {
  const index = templateStyles(parts).findIndex((style) => style.id === styleId)
  if (index < 0) return []
  const node = templateStyleNode(index)
  const seen = new Set<string>()
  const listed: ListedTextStyle[] = []
  const add = (style: { id: string; name: string; font: string; size: number | null }) => {
    if (seen.has(style.id)) return
    seen.add(style.id)
    listed.push({
      id: style.id,
      name: style.name,
      font: style.font,
      shown: shownFont(style.font, major, minor),
      points: style.size === null ? null : style.size / 100,
      size: style.size,
      node,
    })
  }
  for (const slide of readSlides(parts)) {
    if (slideTheme(parts, slide.part) !== styleId) continue
    for (const style of slideTextStyles(parts, slide.part)) {
      const font = style.fields.font
      const size = style.fields.size
      if (font === undefined || size === undefined) continue
      add({ id: style.id, name: style.name, font, size })
    }
  }
  for (const style of masterTextStyles(parts, styleId)) {
    add({ id: style.id, name: designCopy.templateStyleRole[style.role], font: style.font, size: style.size })
  }
  return listed
}

function locate(parts: Parts, id: string): ListedTextStyle | null {
  for (const slide of readSlides(parts)) {
    const styleId = slideTheme(parts, slide.part)
    if (styleId === null) continue
    const found = listedTextStyles(parts, styleId, null, null).find((style) => style.id === id)
    if (found === undefined) continue
    const fonts = templateStyles(parts).find((style) => style.id === styleId)?.palette.fonts
    return { ...found, shown: shownFont(found.font, fonts?.major ?? null, fonts?.minor ?? null) }
  }
  return null
}

function TextStyleDialog({
  deck,
  style,
  onClose,
}: {
  deck: DesigningDeck
  style: ListedTextStyle
  onClose: () => void
}) {
  const size = useRef(style.points === null ? "" : String(style.points))
  const font = useRef(style.shown)
  const [notice, setNotice] = useState("")
  const apply = () => {
    const points = Number(size.current)
    if (!Number.isFinite(points)) return
    const stored = Math.round(points * 100)
    if (stored < 100 || stored > 400_000) {
      setNotice(textCopy.size)
      return
    }
    const typed = font.current.trim()
    const face = typed === "" || typed === style.shown || typed === style.font ? style.font : typed
    if (style.size !== null && stored === style.size && face === style.font) return
    setNotice("")
    changeDesign(deck, () => ({
      target: { node: style.node },
      templateStyle: { textStyle: [{ id: style.id, size: stored, font: face }] },
    }))
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent data-text-style>
        <DialogTitle>{designCopy.editTextStyle}</DialogTitle>
        <DialogDescription>{style.name}</DialogDescription>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{textCopy.size}</span>
          <Input
            aria-label={textCopy.size}
            defaultValue={size.current}
            inputMode="decimal"
            onChange={(event) => {
              size.current = event.currentTarget.value
            }}
            onBlur={apply}
            onKeyDown={(event) => {
              if (event.key === "Enter") apply()
            }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{textCopy.font}</span>
          <Input
            aria-label={textCopy.font}
            defaultValue={font.current}
            onChange={(event) => {
              font.current = event.currentTarget.value
            }}
            onBlur={apply}
            onKeyDown={(event) => {
              if (event.key === "Enter") apply()
            }}
          />
        </label>
        {notice === "" ? null : <p className="text-xs text-muted-foreground">{notice}</p>}
      </DialogContent>
    </Dialog>
  )
}

export function TemplateTextStyleHost({ deck, children }: { deck: DesigningDeck; children: ReactNode }) {
  const [id, setId] = useState<string | null>(null)
  const style = id === null ? null : locate(deck.shown.displayParts.current, id)
  return (
    <TextStyleEditContext.Provider value={setId}>
      {children}
      {style === null ? null : <TextStyleDialog key={style.id} deck={deck} style={style} onClose={() => setId(null)} />}
    </TextStyleEditContext.Provider>
  )
}
