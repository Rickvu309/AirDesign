import { useCallback, useId, useMemo, useSyncExternalStore, type ReactNode } from "react"
import {
  keptRefuses,
  openRegister,
  readElementId,
  readTableValue,
  shapeOf,
  siteKinds,
  takes,
  traits,
  type FieldValue,
  type ElementId,
  type ScopedElement,
  type TraitReads,
} from "@airdesign/document"
import {
  deckColors,
  paintReader,
  readSlides,
  readTraits,
  shownAlphas,
  shownCrop,
  shownEffects,
  shownBody,
  shownConnection,
  shownLink,
  shownFill,
  shownGeometry,
  shownIdentity,
  shownPictureMode,
  shownImage,
  shownLine,
  shownTextStyle,
  shownTurn,
  type DeckTraits,
} from "@airdesign/pptx"
import type { PaintStore, Selection } from "@airdesign/render"
import { LiveTemplateStyle } from "@/editor/live-template-style"
import { Button } from "@/components/ui/button"
import { designCopy } from "@/copy/design-copy"
import type { Palette, Swatch } from "@/design/color-choices"
import { PassageField, passageWords, typedText } from "@/design/controls/text"
import { UnionControl } from "@/design/controls/union"
import { resolveControl } from "@/design/panel-arrangement"
import { SquareSquare, Image } from "lucide-react"
import { PatternFill } from "@/design/preset-icons"
import { ColorPicker } from "@/design/color-picker"
import { ColorField, fieldLook } from "@/design/controls/color"
import {
  panelOf,
  panelOfMany,
  type NodeChoice,
  type PanelModel,
  type PanelReads,
  type PanelControl,
  type PanelSection,
} from "@/design/panel"
import { changeDesign, fileValue, type DesignDeck } from "@/design/design-change"
import { plainNames } from "@/design/node-names"
import { rebasedChange } from "@/design/rebase"
import { siteNames } from "@/design/site-names"
import { deviceScope } from "@/design/trait-edit"
import { designShown, themeOf, type DesignShown } from "@/design-shown"
import { ElementTitleActions } from "./element-title-actions"
import { PicturePreview } from "@/editor/picture-preview"
import { slideListCopy } from "@/copy/slide-list-copy"
import { ControlView, DesignHead, DesignSection, ElementDesign } from "@/editor/design-panel"
import { LiveSelectionColors } from "./live-selection-colors"
type Parts = ReadonlyMap<string, Uint8Array>

export type DesigningDeck = DesignDeck & {
  readonly selectedSlides?: readonly number[]
  readonly selection: Selection
  readonly matching?: readonly ElementId[]
  readonly selectMatching?: () => void
  readonly replacePicture?: (node: ElementId, file: File) => void
}

const deckTraits = new WeakMap<Parts, DeckTraits | null>()

export function readsOf(parts: Parts, node: ElementId): TraitReads {
  if (!deckTraits.has(parts)) {
    try {
      deckTraits.set(parts, readTraits(parts))
    } catch {
      deckTraits.set(parts, null)
    }
  }
  return deckTraits.get(parts)?.elements.get(node)?.reads ?? {}
}

function fontsOf(parts: Parts, node: ElementId) {
  readsOf(parts, node)
  const traits = deckTraits.get(parts)
  return traits?.palettes[traits.slides.get(shapeOf(node).slide) ?? 0]?.fonts ?? {}
}

const shownFields = new WeakMap<Parts, Map<ElementId, PanelReads["fields"]>>()

export function fieldsOf(parts: Parts, node: ElementId): PanelReads["fields"] {
  const read = shownFields.get(parts) ?? new Map<ElementId, PanelReads["fields"]>()
  shownFields.set(parts, read)
  if (!read.has(node)) read.set(node, fieldsRead(parts, node))
  return read.get(node)
}

function fieldsRead(parts: Parts, node: ElementId): PanelReads["fields"] {
  const { slide, shape } = shapeOf(node)
  const part = readSlides(parts).find((each) => each.slide === slide)?.part
  if (part === undefined) return {}
  const at = { slide, part, shape }
  try {
    const fill = shownFill(parts, at)
    const geometry = shownGeometry(parts, at)
    const turn = shownTurn(parts, at)
    const line = Object.entries(shownLine(parts, at) ?? {}).map(([field, shown]) => [`line.${field}`, shown])
    const body = Object.entries(shownBody(parts, at) ?? {}).map(([field, shown]) => [`body.${field}`, shown])
    const text = Object.entries(shownTextStyle(parts, at) ?? {}).map(([field, shown]) => [`text.${field}`, shown])
    const alphas = Object.entries(shownAlphas(parts, at)).map(([trait, value]) => [
      `${trait}.alpha`,
      { value, own: true },
    ])
    const effects = Object.entries(shownEffects(parts, at) ?? {}).map(([field, shown]) => [`effects.${field}`, shown])
    const image = shownImage(parts, at)
    const crop = shownCrop(parts, at)
    const link = shownLink(parts, at)
    const connection = shownConnection(parts, at)
    const identity = Object.entries(shownIdentity(parts, at) ?? {}).map(([field, value]) => [
      `identity.${field}`,
      { value, own: true },
    ])
    return {
      "link.target": { value: link, own: true },
      ...(image === null
        ? {}
        : {
            "image.mode": { value: shownPictureMode(parts, at), own: true },
            "image.source": { value: image.source, own: true },
            "image.recolor": { value: image.recolor, own: true },
            "image.alpha": { value: image.alpha, own: true },
            "image.blur": { value: image.blur === null ? null : Math.min(image.blur, 100_000), own: true },
            "image.overlay": { value: image.overlay, own: true },
          }),
      ...(crop === null ? {} : { "crop.rect": { value: crop, own: true } }),
      ...(connection === null
        ? {}
        : {
            "connection.start": { value: connection.start, own: true },
            "connection.end": { value: connection.end, own: true },
          }),
      ...Object.fromEntries(identity),
      ...(fill === null ? {} : { "fill.value": fill }),
      ...(geometry === null ? {} : { "geometry.shape": geometry }),
      "box.rot": { value: turn.rot, own: true },
      "box.flipH": { value: turn.flipH, own: true },
      "box.flipV": { value: turn.flipV, own: true },
      ...Object.fromEntries(line),
      ...Object.fromEntries(body),
      ...Object.fromEntries(text),
      ...Object.fromEntries(alphas),
      ...Object.fromEntries(effects),
    }
  } catch {
    return {}
  }
}

export function themeAt(parts: Parts, index: number): readonly Swatch[] {
  const part = readSlides(parts)[index]?.part
  return part === undefined ? [] : themeOf(parts, part)
}

const shownColors = new WeakMap<Parts, readonly string[]>()

export function colorsIn(parts: Parts): readonly string[] {
  const known = shownColors.get(parts)
  if (known !== undefined) return known
  let found: readonly string[] = []
  try {
    found = deckColors(parts)
  } catch {
    found = []
  }
  shownColors.set(parts, found)
  return found
}

function nodeChoices(deck: DesigningDeck, connector: ScopedElement): readonly NodeChoice[] {
  const { shown } = deck
  const scope = deviceScope(shown.shownParts.current, shown.shownRegister.current ?? openRegister("", ""))
  const nodes = shown.store.current.slides()[shown.current]?.elements ?? []
  const found = nodes.flatMap((node) => {
    const view = node === connector.node ? undefined : scope.view(node)
    if (
      view === undefined ||
      !siteKinds.includes(view.facts.kind) ||
      view.outline === undefined ||
      view.outline === null
    )
      return []
    if ((view.parent ?? null) !== (connector.parent ?? null)) return []
    const name = fieldsOf(shown.displayParts.current, node)?.["identity.name"]?.value
    const frame = view.box ?? { cx: 0, cy: 0 }
    return [
      {
        node,
        name: typeof name === "string" ? name : "",
        kind: view.facts.kind,
        sites: siteNames(view.outline, frame),
      },
    ]
  })
  const names = plainNames(found)
  return found.map(({ node, sites }, at) => ({ node, name: names[at] ?? node, sites }))
}

function elementDesign(deck: DesigningDeck, node: ElementId): { view: ScopedElement; model: PanelModel } | null {
  const { shown } = deck
  const store = shown.store.current
  const text = store.getElement(node)?.text ?? null
  const box = store.getBox(node)
  const edited = shown.editParts.current
  const opening = deviceScope(shown.shownParts.current, shown.shownRegister.current ?? openRegister("", "")).view(node)
  if (opening === undefined) return null
  const held = opening.value ?? fileValue(shown, node)
  const value = opening.facts.kind === "table" && readTableValue(text ?? "") === null ? held : (text ?? held)
  const view = { ...opening, value, box: box ?? opening.box }
  const model = panelOf(view, {
    fonts: fontsOf(shown.displayParts.current, node),
    reads: readsOf(edited, node),
    moves: shown.movables.current.has(node),
    slides: readSlides(shown.displayParts.current).map((each) => each.slide),
    fields: fieldsOf(shown.displayParts.current, node),
    ...(view.facts.kind === "connector" ? { nodes: nodeChoices(deck, view) } : {}),
  })
  return { view, model }
}

function controlsOf(sections: readonly PanelSection[] | undefined): readonly PanelControl[] {
  return (sections ?? []).flatMap((section) => section.strips.flat())
}

export function usePalette(deck: DesigningDeck): Palette {
  const { shown } = deck
  const { current } = shown
  const display = shown.displayParts.current
  const theme = useMemo(() => themeAt(display, current), [display, current])
  return { theme, deck: colorsIn(display) }
}

function LiveElementDesign({ deck, node }: { deck: DesigningDeck; node: ElementId }) {
  const store = deck.shown.store.current
  useSyncExternalStore(store.elementSubscribe(node), () => store.getElement(node)?.text ?? null)
  useSyncExternalStore(store.boxSubscribe(node), () => store.getBox(node))
  const palette = usePalette(deck)
  const design = elementDesign(deck, node)
  if (design === null) return null
  const at = shapeOf(node)
  const part = readSlides(deck.shown.displayParts.current).find((slide) => slide.slide === at.slide)?.part
  const painted =
    part === undefined
      ? undefined
      : paintReader(deck.shown.displayParts.current)
          .slide(part)
          .elements.find((element) => element.shape === at.shape)
  const image = painted?.image ?? (painted?.fill?.type === "picture" ? painted.fill : null)
  const src = image == null ? null : (deck.shown.pictures.current?.src(image) ?? null)
  return (
    <ElementDesign
      titleActions={
        <ElementTitleActions onMatch={deck.selectMatching} model={design.model} onReplace={deck.replacePicture} />
      }
      formatting={deck.undo.formatting.current}
      picture={src === null ? null : <PicturePreview src={src} />}
      model={design.model}
      palette={palette}
      onChange={(control, value) =>
        changeDesign(deck, () => rebasedChange(controlsOf(elementDesign(deck, node)?.model.sections), control, value))
      }
    >
      <LiveSelectionColors deck={deck} nodes={[node]} />
    </ElementDesign>
  )
}

type Several = readonly [ElementId, ...ElementId[]]

function manyDesign(deck: DesigningDeck, nodes: Several) {
  const [first, ...rest] = nodes.map((node) => elementDesign(deck, node))
  if (first == null || rest.some((design) => design === null)) return null
  const designs = [first, ...rest.filter((design) => design !== null)]
  const model = panelOfMany([first.model, ...designs.slice(1).map((design) => design.model)])
  const views = designs.map(({ view }) => view)
  return { model, designs, views }
}

function editableText(views: readonly ScopedElement[]): boolean {
  return views.every((view) => takes(view.facts).includes("text.value") && !keptRefuses(view.kept, "text", "value"))
}

function useElements(store: PaintStore, nodes: Several): void {
  const key = nodes.join(" ")
  const subscribe = useCallback(
    (listener: () => void) => {
      const stops = key
        .split(" ")
        .flatMap((raw) => readElementId(raw) ?? [])
        .flatMap((id) => [store.elementSubscribe(id)(listener), store.boxSubscribe(id)(listener)])
      return () => {
        for (const stop of stops) stop()
      }
    },
    [store, key],
  )
  const read = () =>
    nodes.map((node) => JSON.stringify([store.getElement(node)?.text ?? null, store.getBox(node)])).join(" ")
  useSyncExternalStore(subscribe, read, read)
}

function LiveManyDesign({ deck, nodes }: { deck: DesigningDeck; nodes: Several }) {
  useElements(deck.shown.store.current, nodes)
  const palette = usePalette(deck)
  const design = manyDesign(deck, nodes)
  if (design === null) return null
  const text = editableText(design.views) ? (
    <DesignSection title={designCopy.multiEditText}>
      <PassageField
        label={designCopy.multiEditText}
        values={design.views.map((view) => view.value ?? "")}
        rich
        onChange={(words) =>
          changeDesign(deck, () => {
            const views = manyDesign(deck, nodes)?.views
            if (views === undefined || !editableText(views)) return []
            return views.flatMap(({ node, value }) =>
              passageWords(value ?? "") === words
                ? []
                : [{ target: { node }, text: { value: typedText(value ?? "", words) } }],
            )
          })
        }
      />
    </DesignSection>
  ) : null
  return (
    <ElementDesign
      model={design.model}
      palette={palette}
      titleActions={<ElementTitleActions onMatch={deck.selectMatching} />}
      afterTitle={text}
      onChange={(control, value) =>
        changeDesign(deck, () => {
          const latest = manyDesign(deck, nodes)
          if (latest === null) return []
          if (control.trait === "corners") {
            const corners = latest.designs.map(({ model }) =>
              controlsOf(model.sections).find(({ trait }) => trait === "corners"),
            )
            return corners.every((corner) => corner !== undefined) ? corners.map((corner) => corner.change(value)) : []
          }
          return rebasedChange(controlsOf(latest.model.sections), control, value)
        })
      }
    >
      {design.designs.every(({ model }) => model.kind === "text") ? null : (
        <LiveSelectionColors deck={deck} nodes={nodes} />
      )}
    </ElementDesign>
  )
}

export function LiveDesignPanel({ deck, selectedSlides = 0 }: { deck: DesigningDeck; selectedSlides?: number }) {
  if (selectedSlides > 1)
    return (
      <div className="flex min-h-0 flex-1 flex-col" data-design-panel>
        <DesignHead>{slideListCopy.selected(selectedSlides)}</DesignHead>
        <LiveTemplateStyle deck={deck} />
        <p className="px-4 py-3 text-[length:var(--type-caption)] text-muted-foreground">{designCopy.selectOneSlide}</p>
      </div>
    )
  const { shown, selection } = deck
  const ids = shown.store.current.slides()[shown.current]?.elements ?? []
  const [first, ...rest] = [...selection.ids.filter((id) => ids.includes(id)), ...(deck.matching ?? [])]
  if (first === undefined) return <LiveSlideDesign deck={deck} />
  if (rest.length === 0) return <LiveElementDesign key={first} deck={deck} node={first} />
  const nodes: Several = [first, ...rest]
  return <LiveManyDesign key={nodes.join(" ")} deck={deck} nodes={nodes} />
}

function LiveSlideDesign({ deck }: { deck: DesigningDeck }) {
  const { shown } = deck
  const parts = shown.displayParts.current
  const painted = shown.canvases.current(shown.current)?.background ?? null
  const view = useMemo(() => designShown(parts, shown.current, painted), [parts, shown.current, painted])
  if (view === null) return null
  return (
    <DesignView
      shown={view}
      deck={colorsIn(parts)}
      onFill={(value) => changeDesign(deck, () => ({ target: { slide: view.slide }, fill: { value } }))}
    >
      <LiveTemplateStyle deck={deck} />
      <LiveSelectionColors deck={deck} nodes={[]} />
    </DesignView>
  )
}

export function DesignView({
  shown,
  deck = [],
  onFill,
  children = null,
}: {
  shown: DesignShown
  deck?: readonly string[]
  onFill: (fill: FieldValue<"fill", "value">) => void
  children?: ReactNode
}) {
  const { background } = shown
  const named = useId()
  const desc = traits.fill.fields.value.desc
  const cases = desc.kind === "union" ? desc.cases : {}
  const base = resolveControl({
    trait: "fill",
    field: "value",
    label: designCopy.background,
    desc: {
      kind: "union",
      plain: null,
      cases: Object.fromEntries(
        Object.entries(cases).filter(([key]) => ["solid", "gradient", "picture"].includes(key)),
      ),
    },
    value: shown.fill ?? (background.value === undefined ? { picture: null } : { solid: background.value }),
    mixed: false,
    inherited: false,
    reset: null,
    change: (value) => ({ target: { slide: shown.slide }, fill: { value: value as FieldValue<"fill", "value"> } }),
  })
  const control = {
    ...base,
    look: { ...base.look, options: { solid: SquareSquare, gradient: PatternFill, picture: Image } },
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" data-design-panel>
      <DesignHead>{designCopy.slide(shown.number)}</DesignHead>
      {children}
      <DesignSection title={designCopy.background} last={children === null}>
        <UnionControl
          control={control}
          palette={{ theme: shown.theme, deck }}
          onChange={(value) => onFill(value as FieldValue<"fill", "value">)}
          inner={(props) =>
            props.control.field === "value.solid" ? (
              <ColorPicker
                title={designCopy.background}
                value={background.value}
                palette={{ theme: shown.theme, deck }}
                onPick={(solid) => onFill({ solid })}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={designCopy.backgroundColor(background.name)}
                    data-design-swatch
                    className={fieldLook}
                  />
                }
              >
                <ColorField id={named} css={background.css} name={background.name} />
              </ColorPicker>
            ) : (
              <ControlView {...props} />
            )
          }
        />
      </DesignSection>
    </div>
  )
}
