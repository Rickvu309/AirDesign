import { bakeFontState } from "@airdesign/render"
import { toast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import * as doom from "@airdesign/doom"
import { useDoomSlide } from "@airdesign/render"
import { useMemo } from "react"
import { designCopy } from "@/copy/design-copy"
import { editorCopy } from "@/copy/editor-copy"
import { panelOfMany, type PanelModel, type PanelPaint } from "@/design/panel"
import { panelSections } from "@/design/panel-order"
import { useServedFaces } from "@/design/served-faces"
import { DesignHead, ElementDesign } from "@/editor/design-sections"
import { ElementTitleActions } from "@/editor/element-title-actions"
import { SlideBackground } from "@/editor/slide-background"
import { PicturePreview } from "@/editor/picture-preview"
import { pickPicture } from "@/editor/picture-picker"
import { RemoveAutoLayoutButton } from "@/editor/remove-auto-layout"
import { changeWrites, linkOf, type ChangeContext } from "./design-changes"
import { storePicture, useAssetUrl } from "./design-media"
import { nodeModel } from "./design-model"
import { paintDesc } from "./design-model-fills"
import { paletteOf } from "./design-palette"
import { fillWrite, shownFill } from "./design-paint-values"
import { DoomSelectionColors } from "./design-selection-section"
import { panelTitle } from "./panel-title"
import { ThemePicker } from "./design-theme-picker"
import { commitDesignEdit } from "./component-edits"
import { resolveColorOf } from "./design-slide-color"
import type { Selection } from "./selection"
import { HiddenLockedLayers } from "./hidden-locked"
import { geometryOf } from "./slide-geometry"
import type { EditorClient } from "./use-deck"
import type { CaretWords } from "./canvas"

type Props = {
  readonly deck: string
  readonly client: EditorClient
  readonly view: doom.Doom
  readonly slide: doom.NodeId
  readonly slideNumber: number
  readonly selection: Selection
  readonly onSelection: (selection: Selection) => void
  readonly words: CaretWords | null
  readonly onCrop: (id: doom.NodeId) => void
  readonly onLinkWords: (link: string | null) => void
}

function backgroundFill(held: PanelPaint): PanelPaint | null {
  if ("gradient" in held) return held
  return "image" in held ? { image: true } : null
}

function isImagePick(value: unknown): boolean {
  return typeof value === "object" && value !== null && "image" in value && value.image === true
}

export function DesignPanel(props: Props) {
  useServedFaces()
  const { deck, client, view, slide, selection, onSelection } = props
  const selectedIds = selection.ids.filter((id) => view.nodes.has(id))
  const [picked] = selectedIds
  const ownerFrame =
    picked !== undefined && selectedIds.length === 1 && view.nodes.get(picked)?.type === "frame"
      ? doom.linkedOwner(view.nodes, picked)
      : undefined
  const ids = ownerFrame === undefined ? selectedIds : [ownerFrame]
  const painted = useDoomSlide(view, slide, 1)
  const geometry = useMemo(() => geometryOf(painted.nodes ?? []), [painted.nodes])
  const theme = doom.deckOf(view).theme
  const palette = useMemo(() => paletteOf(view, theme), [view, theme])
  const slides = doom.slidesOf(view).map((each) => each.id)
  const context: ChangeContext = { view, ids, geometry, size: doom.deckOf(view).size, slides }
  const replaceImage = (targets: readonly doom.NodeId[], file: Blob) => {
    void storePicture(deck, file).then((asset) => {
      if (asset === null) return
      const latest = client.view()
      client.push(
        targets.flatMap((node): doom.Write[] => {
          const next = fillWrite(doom.propOf(latest.nodes.get(node), "fills"), { image: asset })
          return next === undefined ? [] : [{ node, prop: "fills", value: next }]
        }),
      )
    })
  }
  const [only] = ids
  const linked = only !== undefined && ids.length === 1 && doom.propOf(view.nodes.get(only), "instance") !== undefined
  const linkedPart = ids.some((id) => doom.linkedOwner(view.nodes, id) !== undefined)
  const layout = only === undefined || ids.length !== 1 ? undefined : doom.propOf(view.nodes.get(only), "layout")
  const autoLayout = layout !== undefined && layout.mode !== "none"
  const fonts = autoLayout && only !== undefined ? bakeFontState(document, view, only) : "ready"
  const pictured =
    only === undefined
      ? undefined
      : doom.propOf(view.nodes.get(only), "fills")?.findLast((paint) => paint.kind === "image")
  const url = useAssetUrl(deck, pictured?.kind === "image" ? pictured.asset : undefined)
  if (ids.length === 0) {
    const background = doom.propOf(view.nodes.get(slide), "fills")
    const solid = shownFill(background)
    const held = "solid" in solid ? solid.solid : undefined
    const shownColor = held ?? { var: "background" as const }
    return (
      <div
        data-design-panel=""
        aria-label={editorCopy.designPanel}
        role="region"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <DesignHead>{designCopy.slide(props.slideNumber)}</DesignHead>
        <HiddenLockedLayers view={view} slide={slide} push={client.push} />
        {panelSections("slide").map((section) => {
          if (section === "theme")
            return (
              <ThemePicker
                key={section}
                theme={theme}
                onChoose={(id) => {
                  const read = client.view()
                  const deck = [...read.nodes.values()].find(({ type }) => type === "deck")
                  const next = doom.themeLibrary[id]?.theme
                  if (deck !== undefined && next !== undefined)
                    commitDesignEdit(client, [{ node: deck.id, prop: "theme", value: next }], read)
                }}
              />
            )
          if (section === "background")
            return (
              <SlideBackground
                key={section}
                paint={paintDesc}
                shown={{
                  background: resolveColorOf(shownColor, theme, palette),
                  fill: backgroundFill(solid),
                  templateColors: palette.templateColors,
                }}
                deck={palette.deck}
                onFill={(paint) => {
                  if (isImagePick(paint)) return pickPicture((file) => replaceImage([slide], file))
                  const next = fillWrite(background, paint)
                  if (next !== undefined) client.push([{ node: slide, prop: "fills", value: next }])
                }}
              />
            )
          if (section === "selectionColors")
            return (
              <DoomSelectionColors
                key={section}
                client={client}
                view={view}
                slide={slide}
                ids={[]}
                palette={palette}
                onSelection={onSelection}
              />
            )
          return null
        })}
      </div>
    )
  }
  const words = ids.length === 1 && props.words?.node === only ? props.words : null
  const models = ids.map((id) => nodeModel({ view, id, theme, slides, words }))
  const [first, ...rest] = models
  if (first === undefined) return null
  const model: PanelModel = rest.length === 0 ? first : panelOfMany([first, ...rest])
  const measure = painted.measure
  const selected = only === undefined ? undefined : view.nodes.get(only)
  const storedName = doom.propOf(selected, "name")
  const owner = only === undefined ? undefined : doom.linkedOwner(view.nodes, only)
  const key =
    owner === undefined
      ? undefined
      : doom.propOf(view.nodes.get(owner), "instance")?.parts.find(({ node }) => node === only)?.key
  const text = doom.propOf(selected, "text")
  const displayName =
    text !== undefined && key !== undefined && storedName === key.join(" / ")
      ? text.chars.split("\n")[0]?.trim()
      : storedName
  const layerName =
    ids.length === 1
      ? typeof displayName === "string" && displayName !== ""
        ? displayName
        : panelTitle(model)
      : undefined
  return (
    <ElementDesign
      model={model}
      palette={palette}
      layerName={layerName}
      showTextHeading={linkedPart}
      onLayerName={
        only === undefined || ids.length !== 1
          ? undefined
          : (name) => client.push([{ node: only, prop: "name", value: name }])
      }
      picture={url === null ? null : <PicturePreview src={url} />}
      titleActions={
        <ElementTitleActions onMatch={undefined} model={model} onReplace={(_node, file) => replaceImage(ids, file)} />
      }
      afterTitle={
        autoLayout && only !== undefined ? (
          <RemoveAutoLayoutButton
            reason={
              fonts === "pending"
                ? designCopy.layoutFontPending
                : measure === null
                  ? designCopy.layoutMeasuring
                  : undefined
            }
            onRemove={
              measure === null || fonts === "pending"
                ? undefined
                : () => {
                    const fonts = bakeFontState(document, view, only)
                    if (fonts === "failed") toast.refusal(designCopy.layoutFontFailed)
                    if (fonts === "ready") client.push(doom.bakeLayout(view, only, measure))
                  }
            }
          />
        ) : linked && only !== undefined ? (
          <div className="border-b border-line px-4 pb-3">
            <Button
              type="button"
              variant="panel-outline"
              size="sm"
              className="w-full"
              data-linked-detach
              onClick={() => {
                const read = client.view()
                const writes = doom.detachComponent(read, only)
                if (doom.isRefusal(writes) || !client.push(writes, { read }).ok)
                  toast.refusal(designCopy.chartEditFailed)
              }}
            >
              {designCopy.detachInstance}
            </Button>
          </div>
        ) : null
      }
      selectionColors={
        linkedPart ? null : (
          <DoomSelectionColors
            client={client}
            view={view}
            slide={slide}
            ids={ids}
            palette={palette}
            onSelection={onSelection}
          />
        )
      }
      onChange={(control, value) => {
        if (control.trait === "fills" && control.field === "paint" && isImagePick(value))
          return pickPicture((file) => replaceImage(ids, file))
        const link = control.trait === "link" && words !== null ? linkOf(value) : undefined
        if (link !== undefined) return props.onLinkWords(link)
        commitDesignEdit(client, changeWrites(context, control, value), view)
        if (
          control.trait === "image" &&
          control.field === "mode" &&
          value === "crop" &&
          only !== undefined &&
          ids.length === 1
        )
          props.onCrop(only)
      }}
    />
  )
}
