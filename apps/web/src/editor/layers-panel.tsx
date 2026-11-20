import type { ElementId, StackMove } from "@airdesign/document"
import { gestureFor } from "@airdesign/render"
import { Eye, EyeOff, Lock, LockOpen } from "lucide-react"
import {
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react"
import { Announcer, type Announcement } from "@/components/ui/announcer"
import { layersCopy } from "@/copy/layers-copy"
import { EditorIcon, type EditorIconName } from "@/editor/editor-icons"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { depthAt, scrollNearEdge, zoneAt } from "@/editor/layer-drag"
import { useFlagStroke } from "@/editor/layer-flag-stroke"
import { LayerNameField } from "@/editor/layer-name-field"
import {
  frontOf,
  holdsLayers,
  layerPlace,
  layerRange,
  layersUnder,
  openedFor,
  shownLayers,
  type Layer,
  type LayerKind,
  type LayerPlace,
  type ShownLayer,
} from "@/editor/layer-tree"
import type { LayerFlag } from "@/editor/layer-flags"
import { cn } from "@/lib/class-names"

export type LayerPick = "pointer" | "keys"

export type RenameRequest = { readonly node: ElementId; readonly at: number }

export type LayersSource = {
  readonly tree: readonly Layer[]
  readonly selected: readonly ElementId[]
  readonly rename?: RenameRequest | null
  readonly onRenameStarted?: () => void
  readonly onSelect?: (nodes: readonly ElementId[], pick: LayerPick) => void
  readonly onHover?: (node: ElementId | null) => void
  readonly onRename?: (node: ElementId, name: string) => void
  readonly onOrder?: (node: ElementId, before: ElementId | null) => void
  readonly onMove?: (
    node: ElementId,
    parent: ElementId | null,
    before: ElementId | null,
    from: ElementId | null,
  ) => void
  readonly joins?: (node: ElementId, parent: ElementId | null) => boolean
  readonly onStack?: (node: ElementId, move: StackMove) => void
  readonly onFrame?: (nodes: readonly ElementId[]) => void
  readonly onDuplicate?: (nodes: readonly ElementId[]) => void
  readonly onFlag?: (nodes: readonly ElementId[], flag: LayerFlag, on: boolean) => void
}

const kindIcons: Readonly<Record<LayerKind, EditorIconName>> = {
  text: "text",
  shape: "shape",
  picture: "image",
  connector: "line",
  group: "group",
  frame: "frame",
  table: "table",
  chart: "chart",
  kept: "layers",
}

function iconOf(layer: Layer): EditorIconName {
  if (layer.flow === "horizontal") return "flowHorizontal"
  if (layer.flow === "vertical") return "flowVertical"
  return kindIcons[layer.kind]
}

function rowOf(list: HTMLElement | null, node: ElementId): HTMLElement | null {
  return list?.querySelector<HTMLElement>(`[data-layer-row="${node}"]`) ?? null
}

function FlagButton({
  on,
  label,
  mark,
  icon,
  onPress,
  onStroke,
  onPass,
}: {
  readonly on: boolean
  readonly label: string
  readonly mark: string
  readonly icon: ReactNode
  readonly onPress: () => void
  readonly onStroke: () => void
  readonly onPass: () => void
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      aria-pressed={on}
      {...{ [mark]: "" }}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-[var(--shape-control)] text-quiet hover:bg-black/6 hover:text-foreground",
        on ? "" : "opacity-0 group-hover/layer:opacity-100 group-focus-visible/layer:opacity-100",
      )}
      onPointerDown={(event) => {
        if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey) return
        event.preventDefault()
        onStroke()
      }}
      onPointerEnter={onPass}
      onClick={(event) => {
        event.stopPropagation()
        if (event.detail === 0) onPress()
      }}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {icon}
    </button>
  )
}

export function LayersPanel({ layers }: { readonly layers: LayersSource }) {
  const {
    tree,
    selected,
    rename,
    onRenameStarted,
    onSelect,
    onHover,
    onRename,
    onOrder,
    onMove,
    joins,
    onStack,
    onFrame,
    onDuplicate,
    onFlag,
  } = layers
  const list = useRef<HTMLDivElement>(null)
  const anchor = useRef<ElementId | null>(null)
  const dragged = useRef<ElementId | null>(null)
  const joinable = useRef(new Map<ElementId | null, boolean>())
  const stroke = useFlagStroke(onFlag)
  const [open, setOpen] = useState<ReadonlySet<ElementId>>(() => openedFor(tree, selected))
  const [seen, setSeen] = useState(selected)
  const [renaming, setRenaming] = useState<ElementId | null>(null)
  const [handledRename, setHandledRename] = useState<number | null>(null)
  const [spot, setSpot] = useState<LayerPlace["mark"] | null>(null)
  const [stop, setStop] = useState<ElementId | null>(null)
  const [message, setMessage] = useState<Announcement | null>(null)
  const [folded, setFolded] = useState(false)
  const listId = useId()
  if (seen !== selected) {
    setSeen(selected)
    const above = [...openedFor(tree, selected)].filter((node) => !open.has(node))
    if (above.length > 0) setOpen(new Set([...open, ...above]))
  }
  if (rename !== undefined && rename !== null && rename.at !== handledRename) {
    setHandledRename(rename.at)
    const above = [...openedFor(tree, [rename.node])].filter((node) => !open.has(node))
    if (above.length > 0) setOpen(new Set([...open, ...above]))
    if (folded) setFolded(false)
    if (onRename !== undefined) setRenaming(rename.node)
  }
  useEffect(() => {
    if (rename !== undefined && rename !== null && rename.at === handledRename) onRenameStarted?.()
  }, [rename, handledRename, onRenameStarted])
  const shown = shownLayers(tree, open)
  const inside = layersUnder(tree, selected)
  const lead = selected.at(-1) ?? null
  const shownIds = shown.map((each) => each.layer.node)
  const reachable =
    stop !== null && shownIds.includes(stop) ? stop : lead !== null && shownIds.includes(lead) ? lead : shownIds[0]

  useEffect(() => {
    if (lead !== null) rowOf(list.current, lead)?.scrollIntoView({ block: "nearest" })
  }, [lead])
  useEffect(() => () => onHover?.(null), [onHover])

  function toggle(node: ElementId, opened: boolean) {
    setOpen((held) => (opened ? new Set([...held, node]) : new Set([...held].filter((each) => each !== node))))
  }

  function choose(event: MouseEvent<HTMLElement>, node: ElementId) {
    setStop(node)
    if (event.shiftKey && (anchor.current ?? lead) !== null) {
      onSelect?.(layerRange(shown, anchor.current ?? lead ?? node, node), "pointer")
      return
    }
    anchor.current = node
    if (event.metaKey || event.ctrlKey) {
      onSelect?.(selected.includes(node) ? selected.filter((each) => each !== node) : [...selected, node], "pointer")
      return
    }
    onSelect?.([node], "pointer")
  }

  function focusRow(node: ElementId | undefined) {
    if (node === undefined) return
    setStop(node)
    anchor.current = node
    onSelect?.([node], "keys")
    rowOf(list.current, node)?.focus()
  }

  function onRowKey(event: KeyboardEvent<HTMLElement>, row: ShownLayer, at: number) {
    if (event.target !== event.currentTarget || event.nativeEvent.isComposing) return
    const { layer, open: opened } = row
    if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      const keys: Readonly<Record<string, () => void>> = {
        ArrowDown: () => focusRow(shownIds[at + 1]),
        ArrowUp: () => focusRow(shownIds[at - 1]),
        Home: () => focusRow(shownIds[0]),
        End: () => focusRow(shownIds.at(-1)),
        ArrowRight: () =>
          opened === false ? toggle(layer.node, true) : opened ? focusRow(shownIds[at + 1]) : undefined,
        ArrowLeft: () => (opened === true ? toggle(layer.node, false) : focusRow(layer.parent ?? undefined)),
        Enter: () => (onRename === undefined ? undefined : setRenaming(layer.node)),
        F2: () => (onRename === undefined ? undefined : setRenaming(layer.node)),
      }
      const run = keys[event.key]
      if (run !== undefined) {
        event.preventDefault()
        run()
        return
      }
    }
    const gesture = gestureFor(event, "element")
    if (gesture === "front" || gesture === "forward" || gesture === "backward" || gesture === "back") {
      if (onStack === undefined || !editorOwnsKey(event)) return
      event.preventDefault()
      onStack(layer.node, gesture)
      return
    }
    if (gesture === "frame" && onFrame !== undefined && selected.length > 0 && editorOwnsKey(event)) {
      event.preventDefault()
      onFrame(selected)
      return
    }
    if (gesture === "duplicate" && onDuplicate !== undefined && editorOwnsKey(event)) {
      event.preventDefault()
      onDuplicate(selected.includes(layer.node) ? selected : [layer.node])
    }
  }

  function joinsTo(node: ElementId, parent: ElementId | null): boolean {
    const known = joinable.current.get(parent)
    if (known !== undefined) return known
    const found = onMove !== undefined && (joins?.(node, parent) ?? true)
    joinable.current.set(parent, found)
    return found
  }

  function dropOf(event: DragEvent<HTMLElement>, row: ShownLayer): LayerPlace | null {
    const node = dragged.current
    if (node === null) return null
    const zone = zoneAt(event, event.currentTarget, holdsLayers(row.layer))
    const depth = depthAt(event, event.currentTarget, row.depth)
    const place = layerPlace(tree, shown, node, row.layer.node, zone, depth)
    if (place === null) return null
    const stays = shown.find((each) => each.layer.node === node)?.layer.parent === place.parent
    return (stays ? onOrder !== undefined : joinsTo(node, place.parent)) ? place : null
  }

  function moved(place: LayerPlace) {
    const named = (node: ElementId | null) => shown.find((each) => each.layer.node === node)?.layer.name
    const name = named(place.node) ?? ""
    const into = named(place.parent)
    const was = shown.find((each) => each.layer.node === place.node)?.layer.parent ?? null
    const text = into === undefined || was === place.parent ? layersCopy.moved(name) : layersCopy.movedInto(name, into)
    setMessage((held) => ({ text, odd: held === null ? false : !held.odd }))
    if (was === place.parent) onOrder?.(place.node, place.before)
    else onMove?.(place.node, place.parent, place.before, frontOf(tree, place.node))
    if (place.parent !== null && !open.has(place.parent)) setOpen(new Set([...open, place.parent]))
    if (!selected.includes(place.node)) onSelect?.([place.node], "keys")
  }

  function row(each: ShownLayer, at: number) {
    const { layer, depth, open: opened, dim } = each
    const chosen = selected.includes(layer.node)
    const within = !chosen && inside.has(layer.node)
    const editing = renaming === layer.node
    const hidden = stroke.shown(layer.node, "hidden", layer.hidden)
    const locked = stroke.shown(layer.node, "locked", layer.locked)
    const [markRow, zone, markDepth] = spot ?? [null, null, 0]
    const line = markRow === layer.node ? zone : null
    return (
      <div
        key={layer.node}
        role="treeitem"
        aria-level={depth + 1}
        aria-selected={chosen}
        aria-label={[
          layer.name,
          ...(dim ? [layersCopy.hidden] : []),
          ...(layer.locked ? [layersCopy.locked] : []),
        ].join(", ")}
        {...(opened === null ? {} : { "aria-expanded": opened })}
        tabIndex={reachable === layer.node ? 0 : -1}
        draggable={!editing && onOrder !== undefined}
        data-layer-row={layer.node}
        data-layer-kind={layer.kind}
        {...(chosen ? { "data-layer-selected": "" } : {})}
        {...(dim ? { "data-layer-hidden": "" } : {})}
        className={cn(
          "group/layer relative flex h-7 shrink-0 cursor-default items-center gap-1.5 rounded-[var(--shape-control)] pr-1 text-[length:var(--type-caption)] select-none",
          chosen ? "bg-[var(--row)]" : within ? "bg-[var(--row-inside)] hover:bg-black/4" : "hover:bg-black/4",
          dim ? "text-quiet" : "text-foreground",
        )}
        style={{ paddingLeft: `calc(var(--space-4) + ${String(depth)} * var(--space-16))` }}
        onFocus={(event) => {
          if (event.target === event.currentTarget) setStop(layer.node)
        }}
        onPointerEnter={() => onHover?.(layer.node)}
        onClick={(event) => choose(event, layer.node)}
        onDoubleClick={() => {
          if (onRename !== undefined) setRenaming(layer.node)
        }}
        onKeyDown={(event) => onRowKey(event, each, at)}
        onDragStart={(event) => {
          dragged.current = layer.node
          joinable.current = new Map()
          onHover?.(null)
          event.dataTransfer.setData("text/plain", layer.node)
          event.dataTransfer.effectAllowed = "move"
        }}
        onDragOver={(event) => {
          const found = dropOf(event, each)
          if (found === null) {
            if (markRow === layer.node) setSpot(null)
            return
          }
          event.preventDefault()
          event.dataTransfer.dropEffect = "move"
          const [row, side, level] = found.mark
          if (spot?.[0] !== row || spot[1] !== side || spot[2] !== level) setSpot(found.mark)
        }}
        onDrop={(event) => {
          const found = dropOf(event, each)
          setSpot(null)
          dragged.current = null
          if (found === null) return
          event.preventDefault()
          moved(found)
        }}
        onDragEnd={() => {
          dragged.current = null
          setSpot(null)
        }}
      >
        <span
          aria-hidden="true"
          className="flex size-4 shrink-0 items-center justify-center text-faint"
          onClick={(event) => {
            if (opened === null) return
            event.stopPropagation()
            toggle(layer.node, !opened)
          }}
          onDoubleClick={(event) => event.stopPropagation()}
          data-layer-caret={opened === null ? undefined : ""}
        >
          {opened === null ? null : <EditorIcon name={opened ? "chev" : "chevr"} size={12} strokeWidth={2} />}
        </span>
        <EditorIcon name={iconOf(layer)} size={14} className={cn("shrink-0", dim ? "text-faint" : "text-quiet")} />
        {editing ? (
          <LayerNameField
            name={layer.name}
            onDone={(name) => {
              setRenaming(null)
              rowOf(list.current, layer.node)?.focus()
              if (name !== null) onRename?.(layer.node, name)
            }}
          />
        ) : (
          <span className={cn("min-w-0 flex-1 truncate", layer.kind === "frame" && "font-medium")} data-layer-name>
            {layer.name}
          </span>
        )}
        {onFlag === undefined || editing ? null : (
          <>
            <FlagButton
              on={locked}
              label={locked ? layersCopy.unlock(layer.name) : layersCopy.lock(layer.name)}
              mark="data-layer-lock"
              icon={locked ? <Lock aria-hidden="true" size={14} /> : <LockOpen aria-hidden="true" size={14} />}
              onPress={() => onFlag([layer.node], "locked", !layer.locked)}
              onStroke={() => stroke.start(layer.node, "locked", !layer.locked)}
              onPass={() => stroke.enter(layer.node, "locked", layer.locked)}
            />
            <FlagButton
              on={hidden}
              label={hidden ? layersCopy.show(layer.name) : layersCopy.hide(layer.name)}
              mark="data-layer-eye"
              icon={hidden ? <EyeOff aria-hidden="true" size={14} /> : <Eye aria-hidden="true" size={14} />}
              onPress={() => onFlag([layer.node], "hidden", !layer.hidden)}
              onStroke={() => stroke.start(layer.node, "hidden", !layer.hidden)}
              onPass={() => stroke.enter(layer.node, "hidden", layer.hidden)}
            />
          </>
        )}
        {line === null ? null : line === "inside" ? (
          <span
            aria-hidden="true"
            data-layer-drop={line}
            className="pointer-events-none absolute inset-0 rounded-[var(--shape-control)] shadow-[inset_0_0_0_2px_var(--ring)]"
          />
        ) : (
          <span
            aria-hidden="true"
            data-layer-drop={line}
            data-layer-drop-depth={markDepth}
            className={cn(
              "pointer-events-none absolute right-0 h-0.5 bg-[var(--ring)]",
              line === "above" ? "-top-px" : "-bottom-px",
            )}
            style={{ left: `calc(var(--space-24) + ${String(markDepth)} * var(--space-16))` }}
          />
        )}
      </div>
    )
  }

  return (
    <section
      className="flex max-h-[50%] min-h-0 shrink-0 flex-col border-t border-line"
      data-layers-panel
      data-layer-clipboard
      data-keeps-selection
    >
      <h2 className="flex shrink-0 px-1.5 pt-1.5 pb-0.5">
        <button
          type="button"
          aria-expanded={!folded}
          aria-controls={listId}
          data-layers-fold
          onClick={() => setFolded(!folded)}
          className="flex h-8 flex-1 items-center rounded-[var(--shape-control)] px-2.5 text-left text-[length:var(--type-caption)] font-medium text-foreground hover:bg-black/4"
        >
          <span className="flex-1">{layersCopy.section}</span>
          <EditorIcon name={folded ? "chevu" : "chev"} size={12} strokeWidth={2} className="shrink-0 text-faint" />
        </button>
      </h2>
      <Announcer message={message} />
      {folded ? null : tree.length === 0 ? (
        <p id={listId} className="px-4 pb-3 text-[length:var(--type-caption)] text-muted-foreground">
          {layersCopy.empty}
        </p>
      ) : (
        <div
          ref={list}
          id={listId}
          role="tree"
          aria-label={layersCopy.listName}
          aria-multiselectable
          className="flex min-h-0 flex-col overflow-y-auto px-1.5 pb-2"
          data-layer-list
          onPointerLeave={() => onHover?.(null)}
          onDragOver={(event) => {
            if (dragged.current !== null) scrollNearEdge(event, event.currentTarget)
          }}
          onDragLeave={(event) => {
            if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget))
              setSpot(null)
          }}
        >
          {shown.map(row)}
        </div>
      )}
    </section>
  )
}
