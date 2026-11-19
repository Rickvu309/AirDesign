import { bytesOf, nameBytes, type ElementId } from "@airdesign/document"
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
import { designCopy } from "@/copy/design-copy"
import { layersCopy } from "@/copy/layers-copy"
import { EditorIcon, type EditorIconName } from "@/editor/editor-icons"
import {
  layerDrop,
  layerRange,
  layersUnder,
  openedFor,
  shownLayers,
  type Layer,
  type LayerKind,
  type LayerSide,
  type ShownLayer,
} from "@/editor/layer-tree"
import type { LayerFlag } from "@/editor/layer-flags"
import { cn } from "@/lib/class-names"

export type LayerPick = "pointer" | "keys"

export type LayersSource = {
  readonly tree: readonly Layer[]
  readonly selected: readonly ElementId[]
  readonly onSelect?: (nodes: readonly ElementId[], pick: LayerPick) => void
  readonly onHover?: (node: ElementId | null) => void
  readonly onRename?: (node: ElementId, name: string) => void
  readonly onOrder?: (node: ElementId, before: ElementId | null) => void
  readonly onFlag?: (node: ElementId, flag: LayerFlag, on: boolean) => void
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

type Spot = { readonly target: ElementId; readonly side: LayerSide }

function iconOf(layer: Layer): EditorIconName {
  if (layer.flow === "horizontal") return "flowHorizontal"
  if (layer.flow === "vertical") return "flowVertical"
  return kindIcons[layer.kind]
}

function sideOf(event: DragEvent<HTMLElement>): LayerSide {
  const box = event.currentTarget.getBoundingClientRect()
  return event.clientY < box.top + box.height / 2 ? "above" : "below"
}

function rowOf(list: HTMLElement | null, node: ElementId): HTMLElement | null {
  return list?.querySelector<HTMLElement>(`[data-layer-row="${node}"]`) ?? null
}

function sizeOf(words: string) {
  let bytes = 0
  for (const letter of words) bytes += bytesOf(letter)
  return { bytes, wide: bytes > [...words].length }
}

function FlagButton({
  on,
  label,
  mark,
  icon,
  onPress,
}: {
  readonly on: boolean
  readonly label: string
  readonly mark: string
  readonly icon: ReactNode
  readonly onPress: () => void
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
      onClick={(event) => {
        event.stopPropagation()
        onPress()
      }}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {icon}
    </button>
  )
}

function NameEdit({ name, onDone }: { readonly name: string; readonly onDone: (name: string | null) => void }) {
  const [draft, setDraft] = useState(name)
  const problemId = useId()
  const finished = useRef(false)
  const size = sizeOf(draft.trim())
  const problem = size.bytes > nameBytes ? designCopy.tooLong(nameBytes, size.wide) : null
  function finish(keep: boolean) {
    if (finished.current) return
    finished.current = true
    const typed = draft.trim()
    onDone(keep && problem === null && typed !== "" && typed !== name ? typed : null)
  }
  return (
    <span className="relative flex min-w-0 flex-1">
      <input
        autoFocus
        data-layer-name-field
        aria-label={layersCopy.rename(name)}
        aria-invalid={problem === null ? undefined : true}
        aria-describedby={problem === null ? undefined : problemId}
        value={draft}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={() => finish(true)}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.nativeEvent.isComposing) return
          if (event.key === "Enter" && problem === null) {
            event.preventDefault()
            finish(true)
          }
          if (event.key === "Escape") {
            event.preventDefault()
            finish(false)
          }
        }}
        className="h-6 w-full min-w-0 flex-1 rounded-[var(--shape-control)] bg-background px-1 [--focus-ring-offset:0px] text-[length:var(--type-caption)] text-foreground shadow-[0_0_0_1px_var(--ring)] aria-invalid:shadow-[0_0_0_2px_var(--destructive)]"
      />
      {problem === null ? null : (
        <span
          id={problemId}
          role="alert"
          className="absolute top-7 left-0 z-10 w-max max-w-[200px] rounded-[var(--shape-control)] bg-background px-2 py-1.5 text-[length:var(--type-caption)] leading-[var(--leading-body)] text-danger-text shadow-[0_0_0_1px_var(--field-edge),0_4px_12px_var(--black-6)]"
        >
          {problem}
        </span>
      )}
    </span>
  )
}

export function LayersPanel({ layers }: { readonly layers: LayersSource }) {
  const { tree, selected, onSelect, onHover, onRename, onOrder, onFlag } = layers
  const list = useRef<HTMLDivElement>(null)
  const anchor = useRef<ElementId | null>(null)
  const dragged = useRef<ElementId | null>(null)
  const [open, setOpen] = useState<ReadonlySet<ElementId>>(() => openedFor(tree, selected))
  const [seen, setSeen] = useState(selected)
  const [renaming, setRenaming] = useState<ElementId | null>(null)
  const [spot, setSpot] = useState<Spot | null>(null)
  const [stop, setStop] = useState<ElementId | null>(null)
  const [message, setMessage] = useState<Announcement | null>(null)
  const [folded, setFolded] = useState(false)
  const listId = useId()
  if (seen !== selected) {
    setSeen(selected)
    const above = [...openedFor(tree, selected)].filter((node) => !open.has(node))
    if (above.length > 0) setOpen(new Set([...open, ...above]))
  }
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
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return
    const { layer, open: opened } = row
    const keys: Readonly<Record<string, () => void>> = {
      ArrowDown: () => focusRow(shownIds[at + 1]),
      ArrowUp: () => focusRow(shownIds[at - 1]),
      Home: () => focusRow(shownIds[0]),
      End: () => focusRow(shownIds.at(-1)),
      ArrowRight: () => (opened === false ? toggle(layer.node, true) : opened ? focusRow(shownIds[at + 1]) : undefined),
      ArrowLeft: () => (opened === true ? toggle(layer.node, false) : focusRow(layer.parent ?? undefined)),
      Enter: () => (onRename === undefined ? undefined : setRenaming(layer.node)),
      F2: () => (onRename === undefined ? undefined : setRenaming(layer.node)),
    }
    const run = keys[event.key]
    if (run === undefined || event.shiftKey) return
    event.preventDefault()
    run()
  }

  function dropOf(event: DragEvent<HTMLElement>, target: ElementId) {
    const node = dragged.current
    if (node === null) return null
    const side = sideOf(event)
    const drop = layerDrop(tree, node, target, side)
    return drop === null ? null : { drop, spot: { target, side } }
  }

  function row(each: ShownLayer, at: number) {
    const { layer, depth, open: opened, dim } = each
    const chosen = selected.includes(layer.node)
    const within = !chosen && inside.has(layer.node)
    const editing = renaming === layer.node
    const line = spot?.target === layer.node ? spot.side : null
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
          onHover?.(null)
          event.dataTransfer.setData("text/plain", layer.node)
          event.dataTransfer.effectAllowed = "move"
        }}
        onDragOver={(event) => {
          const found = dropOf(event, layer.node)
          if (found === null) {
            if (spot?.target === layer.node) setSpot(null)
            return
          }
          event.preventDefault()
          event.dataTransfer.dropEffect = "move"
          if (spot?.target !== found.spot.target || spot.side !== found.spot.side) setSpot(found.spot)
        }}
        onDrop={(event) => {
          const found = dropOf(event, layer.node)
          setSpot(null)
          dragged.current = null
          if (found === null) return
          event.preventDefault()
          setMessage((held) => ({ text: layersCopy.moved(each.layer.name), odd: held === null ? false : !held.odd }))
          onOrder?.(found.drop.node, found.drop.before)
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
          <NameEdit
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
              on={layer.locked}
              label={layer.locked ? layersCopy.unlock(layer.name) : layersCopy.lock(layer.name)}
              mark="data-layer-lock"
              icon={layer.locked ? <Lock aria-hidden="true" size={14} /> : <LockOpen aria-hidden="true" size={14} />}
              onPress={() => onFlag(layer.node, "locked", !layer.locked)}
            />
            <FlagButton
              on={layer.hidden}
              label={layer.hidden ? layersCopy.show(layer.name) : layersCopy.hide(layer.name)}
              mark="data-layer-eye"
              icon={layer.hidden ? <EyeOff aria-hidden="true" size={14} /> : <Eye aria-hidden="true" size={14} />}
              onPress={() => onFlag(layer.node, "hidden", !layer.hidden)}
            />
          </>
        )}
        {line === null ? null : (
          <span
            aria-hidden="true"
            data-layer-drop={line}
            className={cn(
              "pointer-events-none absolute right-0 h-0.5 bg-[var(--ring)]",
              line === "above" ? "-top-px" : "-bottom-px",
            )}
            style={{ left: `calc(var(--space-24) + ${String(depth)} * var(--space-16))` }}
          />
        )}
      </div>
    )
  }

  return (
    <section
      className="flex max-h-[50%] min-h-0 shrink-0 flex-col border-t border-line"
      data-layers-panel
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
