import { Fragment, useCallback, useId, useMemo, useSyncExternalStore, type ReactNode } from "react"
import {
  keptRefuses,
  openRegister,
  readElementId,
  readLayout,
  readTableValue,
  shapeOf,
  takes,
  traits,
  type Paint,
  type ElementId,
  type ScopedElement,
  type TraitReads,
} from "@airdesign/document"
import { paintReader, readSlides, readTraits, type DeckTraits } from "@airdesign/pptx"
import type { PaintStore, Selection } from "@airdesign/render"
import { LiveTemplateStyle } from "@/editor/live-template-style"
import { fieldsOf } from "@/editor/panel-fields"
import { TemplateTextStyleHost } from "@/editor/text-style-dialog"
import { Button } from "@/components/ui/button"
import { designCopy } from "@/copy/design-copy"
import type { Palette, Swatch } from "@/design/color-choices"
import { passageWords, typedText } from "@/design/controls/text"
import { MultiEditText } from "@/editor/multi-edit-text"
import { UnionControl } from "@/design/controls/union"
import { resolveControl } from "@/design/panel-arrangement"
import { fillIcons } from "@/design/preset-icons"
import { ColorPicker } from "@/design/color-picker"
import { ColorField, fieldLook } from "@/design/controls/color"
import { panelOf, panelOfMany, type PanelModel, type PanelControl, type PanelSection } from "@/design/panel"
import { panelPlaces, type PanelMode } from "@/design/panel-order"
import { changeDesign, fileValue, type DesignDeck } from "@/design/design-change"
import { rebasedChange } from "@/design/rebase"
import { chosenFill } from "@/design/fill-image"
import { deviceScope } from "@/design/trait-edit"
import { framePanel } from "@/design/frame-panel"
import { RemoveAutoLayout } from "@/editor/remove-auto-layout"
import { designShown, templateColorsOf, type DesignShown } from "@/design-shown"
import { SlideSurface } from "@/editor/slide-design-tabs"
import { colorsIn } from "./deck-colors"
import { nodeChoices } from "./node-choices"
import { placeholderRole } from "./placeholder-role"
import { ElementTitleActions } from "./element-title-actions"
import { PicturePreview } from "@/editor/picture-preview"
import { slideListCopy } from "@/copy/slide-list-copy"
import { ControlView, DesignHead, DesignSection, ElementDesign } from "@/editor/design-panel"
import { AdjustTone, type ToneControlFor } from "@/editor/adjust-tone"
import { toneScope } from "@/editor/tone-scope"
import { LiveSelectionColors } from "./live-selection-colors"
import { liveSlideNumber } from "./live-slide-number"

type Parts = ReadonlyMap<string, Uint8Array>

export type DesigningDeck = DesignDeck & {
  readonly selectedSlides?: readonly number[]
  readonly selection: Selection
  readonly matching?: readonly ElementId[]
  readonly selectMatching?: () => void
  readonly matchable?: boolean
  readonly replacePicture?: (node: ElementId, file: File) => void
  readonly chooseFillImage?: (node: ElementId) => void
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

export function templateColorsAt(parts: Parts, index: number): readonly Swatch[] {
  const part = readSlides(parts)[index]?.part
  return part === undefined ? [] : templateColorsOf(parts, part)
}

function elementDesign(deck: DesigningDeck, node: ElementId): { view: ScopedElement; model: PanelModel } | null {
  const design = nodeDesign(deck, node)
  const register = deck.shown.shownRegister.current
  if (design === null || design.model.kind !== "frame" || register === null) return design
  const layout = readLayout(register, node)
  const backdrop = layout === null ? null : nodeDesign(deck, layout.backdrop)
  if (layout === null || backdrop === null) return design
  return { view: design.view, model: framePanel(design.model, backdrop.model, layout.flow !== "none") }
}

function nodeDesign(deck: DesigningDeck, node: ElementId): { view: ScopedElement; model: PanelModel } | null {
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
  const role = placeholderRole(shown.displayParts.current, node)
  const model = panelOf(view, {
    fonts: fontsOf(shown.displayParts.current, node),
    reads: readsOf(edited, node),
    moves: shown.movables.current.has(node),
    slides: readSlides(shown.displayParts.current).map((each) => each.slide),
    fields: fieldsOf(shown.displayParts.current, node),
    ...(role === undefined ? {} : { role }),
    ...(view.facts.kind === "connector"
      ? {
          nodes: nodeChoices(
            deck,
            view,
            (choice) => fieldsOf(shown.displayParts.current, choice)?.["identity.name"]?.value,
          ),
        }
      : {}),
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
  const templateColors = useMemo(() => templateColorsAt(display, current), [display, current])
  return { templateColors, deck: colorsIn(display) }
}

function toneHead(deck: DesigningDeck, selection: readonly ElementId[], toneFor?: ToneControlFor) {
  if (toneFor === undefined) return null
  const scope = toneScope(deck.shown, selection)
  return scope === null ? null : <AdjustTone key={[scope.slide, ...selection].join(" ")} action={toneFor(scope)} />
}

function matchAction(deck: DesigningDeck) {
  return deck.matchable === true ? deck.selectMatching : undefined
}

function LiveElementDesign({
  deck,
  node,
  mode,
  toneFor,
}: {
  deck: DesigningDeck
  node: ElementId
  mode: PanelMode
  toneFor?: ToneControlFor
}) {
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
        <div className="flex items-center gap-1">
          {design.model.kind === "group" ? toneHead(deck, [node], toneFor) : null}
          <ElementTitleActions onMatch={matchAction(deck)} model={design.model} onReplace={deck.replacePicture} />
        </div>
      }
      formatting={deck.undo.formatting.current}
      picture={src === null ? null : <PicturePreview src={src} />}
      model={design.model}
      afterAlignment={liveSlideNumber(deck, node, design.view.value)}
      afterTitle={design.model.frame === "auto" ? <RemoveAutoLayout deck={deck} node={node} /> : null}
      mode={mode}
      selectionColors={<LiveSelectionColors deck={deck} nodes={[node]} />}
      palette={palette}
      onChange={(control, value) => {
        const chosen = chosenFill(value, control, deck.shown.shownParts.current, deck.shown.shownRegister.current, node)
        if ("pick" in chosen) {
          deck.chooseFillImage?.(node)
          return
        }
        changeDesign(deck, () =>
          rebasedChange(controlsOf(elementDesign(deck, node)?.model.sections), control, chosen.value),
        )
      }}
    />
  )
}

type Several = readonly [ElementId, ...ElementId[]]

function manyDesign(deck: DesigningDeck, nodes: Several, mode: PanelMode) {
  const [first, ...rest] = nodes.map((node) => elementDesign(deck, node))
  if (first == null || rest.some((design) => design === null)) return null
  const designs = [first, ...rest.filter((design) => design !== null)]
  const model = panelOfMany([first.model, ...designs.slice(1).map((design) => design.model)], mode)
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

function LiveManyDesign({
  deck,
  nodes,
  mode,
  toneFor,
}: {
  deck: DesigningDeck
  nodes: Several
  mode: PanelMode
  toneFor?: ToneControlFor
}) {
  useElements(deck.shown.store.current, nodes)
  const palette = usePalette(deck)
  const design = manyDesign(deck, nodes, mode)
  if (design === null) return null
  const text = editableText(design.views) ? (
    <MultiEditText
      values={design.views.map((view) => view.value ?? "")}
      onChange={(words) =>
        changeDesign(deck, () => {
          const views = manyDesign(deck, nodes, mode)?.views
          if (views === undefined || !editableText(views)) return []
          return views.flatMap(({ node, value }) =>
            passageWords(value ?? "") === words
              ? []
              : [{ target: { node }, text: { value: typedText(value ?? "", words) } }],
          )
        })
      }
    />
  ) : null
  return (
    <ElementDesign
      model={design.model}
      mode={mode}
      selectionColors={<LiveSelectionColors deck={deck} nodes={nodes} />}
      palette={palette}
      titleActions={
        <div className="flex items-center gap-1">
          {toneHead(deck, nodes, toneFor)}
          {text}
          <ElementTitleActions onMatch={matchAction(deck)} />
        </div>
      }
      onChange={(control, value) =>
        changeDesign(deck, () => {
          const latest = manyDesign(deck, nodes, mode)
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
    />
  )
}

type PanelProps = {
  deck: DesigningDeck
  mode: PanelMode
  onMode?: (mode: PanelMode) => void
  selectedSlides?: number
  toneFor?: ToneControlFor
}

export function LiveDesignPanel(props: PanelProps) {
  return (
    <TemplateTextStyleHost deck={props.deck}>
      <DesignPanelSwitch {...props} />
    </TemplateTextStyleHost>
  )
}

function DesignPanelSwitch({ deck, selectedSlides = 1, mode, toneFor }: PanelProps) {
  if (selectedSlides === 0)
    return (
      <div className="flex min-h-0 flex-1 flex-col" data-design-panel>
        <DesignHead>{slideListCopy.nothingSelected}</DesignHead>
        <p className="px-4 py-3 text-[length:var(--type-caption)] text-muted-foreground">{designCopy.selectSlide}</p>
      </div>
    )
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
  if (first === undefined) return <LiveSlideDesign deck={deck} mode={mode} toneFor={toneFor} />
  if (rest.length === 0) return <LiveElementDesign key={first} deck={deck} node={first} mode={mode} toneFor={toneFor} />
  const nodes: Several = [first, ...rest]
  return <LiveManyDesign key={nodes.join(" ")} deck={deck} nodes={nodes} mode={mode} toneFor={toneFor} />
}

function LiveSlideDesign({ deck, mode, toneFor }: { deck: DesigningDeck; mode: PanelMode; toneFor?: ToneControlFor }) {
  return <SlideSurface deck={deck} design={<SlideChrome deck={deck} mode={mode} toneFor={toneFor} />} />
}

function SlideChrome({ deck, mode, toneFor }: { deck: DesigningDeck; mode: PanelMode; toneFor?: ToneControlFor }) {
  const { shown } = deck
  const parts = shown.displayParts.current
  const painted = shown.canvases.current(shown.current)?.background ?? null
  const view = useMemo(() => designShown(parts, shown.current, painted), [parts, shown.current, painted])
  if (view === null) return null
  const sections = new Map<string, ReactNode>([
    ["templateStyle", <LiveTemplateStyle deck={deck} />],
    [
      "background",
      <SlideBackground
        shown={view}
        deck={colorsIn(parts)}
        onFill={(paint) => changeDesign(deck, () => ({ target: { slide: view.slide }, fills: { paint } }))}
      />,
    ],
    ["selectionColors", <LiveSelectionColors deck={deck} nodes={[]} />],
  ])
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" data-design-panel>
      <DesignHead actions={toneHead(deck, [], toneFor)}>{designCopy.slide(view.number)}</DesignHead>
      {panelPlaces("slide", mode).map(({ section }) => (
        <Fragment key={section}>{sections.get(section)}</Fragment>
      ))}
    </div>
  )
}

function SlideBackground({
  shown,
  deck,
  onFill,
}: {
  shown: DesignShown
  deck: readonly string[]
  onFill: (paint: Paint) => void
}) {
  const { background } = shown
  const named = useId()
  const desc = traits.fills.inputs.paint.desc
  const cases = desc.kind === "union" ? desc.cases : {}
  const base = resolveControl({
    trait: "fills",
    field: "paint",
    label: designCopy.background,
    desc: {
      kind: "union",
      plain: null,
      cases: Object.fromEntries(Object.entries(cases).filter(([key]) => ["solid", "gradient", "image"].includes(key))),
    },
    value: shown.fill ?? (background.value === undefined ? { image: null } : { solid: background.value }),
    mixed: false,
    inherited: false,
    reset: null,
    change: (value) => ({ target: { slide: shown.slide }, fills: { paint: value as Paint } }),
  })
  const control = {
    ...base,
    look: {
      ...base.look,
      options: { solid: fillIcons.solid, gradient: fillIcons.gradient, image: fillIcons.image },
    },
  }
  return (
    <DesignSection title={designCopy.background}>
      <UnionControl
        control={control}
        palette={{ templateColors: shown.templateColors, deck }}
        onChange={(value) => onFill(value as Paint)}
        inner={(props) =>
          props.control.field === "paint.solid" ? (
            <ColorPicker
              title={designCopy.background}
              value={background.value}
              palette={{ templateColors: shown.templateColors, deck }}
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
  )
}
