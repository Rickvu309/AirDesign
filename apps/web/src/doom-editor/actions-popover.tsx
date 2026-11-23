import { ChartBar, ChartColumn, ChartLine, ChartNoAxesColumn, ChartPie, FileDown, Search } from "lucide-react"
import { DynamicIcon, type IconName } from "lucide-react/dynamic"
import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type KeyboardEvent } from "react"
import { doomEditorCopy } from "@/copy/doom-editor-copy"
import { iconMatches, startingIcons } from "@/design/icon-search"
import { cn } from "@/lib/class-names"
import { composing } from "@/lib/composing"
import * as doom from "@airdesign/doom"
import { stepHighlight, type HighlightKey } from "./actions-highlight"

export type ActionRun = {
  readonly chart: (kind: doom.Chart["kind"]) => void
  readonly icon: (name: string) => void
  readonly exportPdf: () => void
}

type Action = {
  readonly key: string
  readonly label: string
  readonly glyph: ComponentType<{ className?: string }>
  readonly run: (run: ActionRun, finish: () => void) => void
}

type Group = {
  readonly id: string
  readonly title: string
  readonly find: (words: string) => readonly Action[]
}

const charts: readonly { readonly kind: doom.Chart["kind"]; readonly glyph: ComponentType<{ className?: string }> }[] =
  [
    { kind: "column", glyph: ChartColumn },
    { kind: "bar", glyph: ChartBar },
    { kind: "line", glyph: ChartLine },
    { kind: "pie", glyph: ChartPie },
    { kind: "stacked", glyph: ChartNoAxesColumn },
  ]

const chartsGroup: Group = {
  id: "charts",
  title: doomEditorCopy.chartsGroup,
  find: (words) =>
    charts
      .filter(
        ({ kind }) =>
          words === "" ||
          doomEditorCopy.chartKinds[kind].toLowerCase().includes(words) ||
          doomEditorCopy.chartsGroup.toLowerCase().includes(words),
      )
      .map(({ kind, glyph }) => ({
        key: kind,
        label: doomEditorCopy.chartKinds[kind],
        glyph,
        run(run, finish) {
          run.chart(kind)
          finish()
        },
      })),
}

const deckGroup: Group = {
  id: "deck",
  title: doomEditorCopy.deckGroup,
  find: (words) =>
    words === "" || `${doomEditorCopy.deckGroup} ${doomEditorCopy.exportPdf} print`.toLowerCase().includes(words)
      ? [
          {
            key: "export-pdf",
            label: doomEditorCopy.exportPdf,
            glyph: FileDown,
            run(run, finish) {
              finish()
              run.exportPdf()
            },
          },
        ]
      : [],
}

const actionGroups: readonly Group[] = [chartsGroup, deckGroup]
const iconColumns = 8
const highlightKeys = new Set<string>(["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"])

const highlightKey = (key: string): key is HighlightKey => highlightKeys.has(key)

const optionClass = "cursor-default rounded-md aria-selected:bg-muted"
const rowClass = cn(optionClass, "flex h-8 w-full items-center gap-2.5 px-2 text-left text-[length:var(--type-dense)]")

export function ActionsPanel(props: { readonly run: ActionRun; readonly finish: () => void }) {
  const id = useId()
  const field = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [all, setAll] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  const words = query.trim()
  const names = useMemo(() => (words === "" ? startingIcons.slice(0, 8) : iconMatches(words, 32)), [words])
  const iconNames = all && words === "" ? iconMatches("", 24) : names
  const sections = all
    ? []
    : actionGroups
        .map((group) => ({ group, actions: group.find(words.toLowerCase()) }))
        .filter((each) => each.actions.length > 0)
  const rows = sections.flatMap((each) => each.actions)
  const layout = { rows: rows.length, icons: iconNames.length, columns: iconColumns }
  const total = layout.rows + layout.icons
  const highlighted = active !== null && active < total ? active : null
  const optionId = (index: number) => `${id}-option-${index}`
  const listId = `${id}-results`

  useEffect(() => {
    if (highlighted === null) return
    window.document.getElementById(optionId(highlighted))?.scrollIntoView?.({ block: "nearest" })
  })

  const choose = (index: number) => {
    const row = rows[index]
    if (row !== undefined) return row.run(props.run, props.finish)
    const name = iconNames[index - rows.length]
    if (name === undefined) return
    props.run.icon(name)
    props.finish()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (composing(event)) return
    if (highlightKey(event.key)) {
      const next = stepHighlight(layout, highlighted, event.key)
      if (next === null) return
      event.preventDefault()
      setActive(next)
    } else if (event.key === "Enter" && highlighted !== null) {
      event.preventDefault()
      choose(highlighted)
    }
  }

  const option = (index: number) => ({
    id: optionId(index),
    role: "option",
    "aria-selected": index === highlighted,
    onMouseMove: () => {
      if (index !== highlighted) setActive(index)
    },
    onClick: () => choose(index),
  })

  const nothing = total === 0
  return (
    <div className="flex flex-col gap-1 text-[length:var(--type-dense)]" data-actions-panel="">
      <label htmlFor={id} className="sr-only">
        {doomEditorCopy.actionsSearch}
      </label>
      <div data-focus-ring className="flex items-center gap-2 rounded-lg bg-muted px-2.5">
        <Search className="size-3.5 shrink-0 text-quiet" />
        <input
          ref={field}
          id={id}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={!nothing}
          aria-controls={listId}
          {...(highlighted === null ? {} : { "aria-activedescendant": optionId(highlighted) })}
          autoFocus
          placeholder={doomEditorCopy.actionsSearch}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(event.target.value.trim() === "" ? null : 0)
          }}
          onKeyDown={onKeyDown}
          className="h-8 w-full min-w-0 bg-transparent text-[length:var(--type-dense)] outline-none placeholder:text-quiet"
        />
      </div>
      <div
        id={listId}
        role="listbox"
        aria-label={doomEditorCopy.actions}
        className="flex flex-col gap-1"
        onMouseDown={(event) => event.preventDefault()}
      >
        {sections.map(({ group, actions }) => (
          <div key={group.id} role="group" aria-labelledby={`${id}-${group.id}`} data-actions-group={group.id}>
            <p id={`${id}-${group.id}`} className="px-2 pt-2 pb-1 text-[length:var(--type-dense)] text-quiet">
              {group.title}
            </p>
            {actions.map((action) => (
              <div key={action.key} className={rowClass} {...option(rows.indexOf(action))}>
                <action.glyph className="size-4" />
                {action.label}
              </div>
            ))}
          </div>
        ))}
        <div role="group" aria-labelledby={`${id}-icons`} data-actions-group="icons">
          <p id={`${id}-icons`} className="px-2 pt-2 pb-1 text-quiet">
            {doomEditorCopy.iconsGroup}
          </p>
          {iconNames.length === 0 ? null : (
            <div className="grid grid-cols-8 gap-0.5 px-1">
              {iconNames.map((name, index) => (
                <div
                  key={name}
                  aria-label={name}
                  title={name}
                  className={cn(optionClass, "flex size-8 items-center justify-center")}
                  {...option(rows.length + index)}
                >
                  <DynamicIcon name={name as IconName} size={18} aria-hidden="true" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {all ? null : (
        <button
          type="button"
          className={cn(rowClass, "-mt-1 text-quiet hover:bg-muted")}
          onClick={() => {
            setAll(true)
            setActive(null)
            field.current?.focus()
          }}
        >
          {doomEditorCopy.allIcons}
        </button>
      )}
      {nothing ? <p className="px-2 py-1 text-quiet">{doomEditorCopy.noActions}</p> : null}
    </div>
  )
}
