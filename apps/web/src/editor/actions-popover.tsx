import { Input } from "@/components/ui/input"
import { ChartBar, ChartColumn, ChartLine, ChartPie, FileDown, Image, Search, createLucideIcon } from "lucide-react"
import { DynamicIcon, type IconName } from "lucide-react/dynamic"
import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type KeyboardEvent } from "react"
import { editorCopy } from "@/copy/editor-copy"
import { iconMatches, startingIcons } from "@/design/icon-search"
import { cn } from "@/lib/class-names"
import { composing } from "@/lib/composing"
import { stepHighlight, type HighlightKey } from "./actions-highlight"
import { pickPicture } from "./picture-picker"

export type ActionRun = {
  readonly chart: ((chart: ChartInsert) => void) | null
  readonly icon: (name: string) => void
  readonly picture: (file: File) => void
  readonly exportPdf: () => void
}

type Action = {
  readonly key: string
  readonly label: string
  readonly glyph: ComponentType<{ className?: string }>
  readonly needsMeasure?: boolean
  readonly run: (run: ActionRun, finish: () => void) => void
}

type Group = {
  readonly id: string
  readonly title: string
  readonly find: (words: string) => readonly Action[]
}

const StackedChart = createLucideIcon("StackedChart", [
  ["path", { d: "M3 3v18h18", key: "axis" }],
  ["path", { d: "M7 21V10h4v11M7 15h4M15 21V5h4v16M15 12h4", key: "columns" }],
])

const WaterfallChart = createLucideIcon("WaterfallChart", [
  ["path", { d: "M3 3v18h18", key: "axis" }],
  ["path", { d: "M6 21v-8h3v8m3-8V9h3v4Zm6 8V9h3v12M9 13h3m3-4h3", key: "columns" }],
])

const chartInserts = [
  { id: "column", component: "column", label: editorCopy.chartKinds.column, glyph: ChartColumn },
  {
    id: "bar",
    component: "clustered-chart",
    variant: { orientation: "bar" },
    label: editorCopy.chartKinds.bar,
    glyph: ChartBar,
  },
  { id: "stacked", component: "stacked", label: editorCopy.chartKinds.stacked, glyph: StackedChart },
  { id: "waterfall", component: "waterfall", label: editorCopy.chartKinds.waterfall, glyph: WaterfallChart },
  { id: "line", component: "line", label: editorCopy.chartKinds.line, glyph: ChartLine },
  { id: "pie", component: "pie", label: editorCopy.chartKinds.pie, glyph: ChartPie },
] as const

export type ChartInsert = (typeof chartInserts)[number]

const imageGroup: Group = {
  id: "image",
  title: editorCopy.imageGroup,
  find: (words) =>
    words === "" || `${editorCopy.imageGroup} ${editorCopy.placeImage} picture`.toLowerCase().includes(words)
      ? [
          {
            key: "place-image",
            label: editorCopy.placeImage,
            glyph: Image,
            run(run, finish) {
              pickPicture((file) => run.picture(file))
              finish()
            },
          },
        ]
      : [],
}

const chartsGroup: Group = {
  id: "charts",
  title: editorCopy.chartsGroup,
  find: (words) =>
    chartInserts
      .filter(
        ({ label }) =>
          words === "" || label.toLowerCase().includes(words) || editorCopy.chartsGroup.toLowerCase().includes(words),
      )
      .map((chart) => ({
        key: chart.id,
        label: chart.label,
        glyph: chart.glyph,
        needsMeasure: true,
        run(run, finish) {
          run.chart?.(chart)
          finish()
        },
      })),
}

const deckGroup: Group = {
  id: "deck",
  title: editorCopy.deckGroup,
  find: (words) =>
    words === "" || `${editorCopy.deckGroup} ${editorCopy.exportPdf} print`.toLowerCase().includes(words)
      ? [
          {
            key: "export-pdf",
            label: editorCopy.exportPdf,
            glyph: FileDown,
            run(run, finish) {
              finish()
              run.exportPdf()
            },
          },
        ]
      : [],
}

const actionGroups: readonly Group[] = [imageGroup, chartsGroup, deckGroup]
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

  const highlightedId = highlighted === null ? null : optionId(highlighted)
  useEffect(() => {
    if (highlightedId === null) return
    window.document.getElementById(highlightedId)?.scrollIntoView?.({ block: "nearest" })
  }, [highlightedId])

  const choose = (index: number) => {
    const row = rows[index]
    if (row !== undefined) {
      if (!row.needsMeasure || props.run.chart !== null) row.run(props.run, props.finish)
      return
    }
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
        {editorCopy.actionsSearch}
      </label>
      <div data-focus-ring className="flex items-center gap-2 rounded-lg bg-muted px-2.5">
        <Search className="size-3.5 shrink-0 text-quiet" />
        <Input
          variant="embedded"
          ref={field}
          id={id}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={!nothing}
          aria-controls={listId}
          {...(highlighted === null ? {} : { "aria-activedescendant": optionId(highlighted) })}
          autoFocus
          placeholder={editorCopy.actionsSearch}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(event.target.value.trim() === "" ? null : 0)
          }}
          onKeyDown={onKeyDown}
          className="h-8 w-full"
        />
      </div>
      <div
        id={listId}
        role="listbox"
        aria-label={editorCopy.actions}
        className="flex flex-col gap-1"
        onMouseDown={(event) => event.preventDefault()}
      >
        {sections.map(({ group, actions }) => (
          <div key={group.id} role="group" aria-labelledby={`${id}-${group.id}`} data-actions-group={group.id}>
            <p id={`${id}-${group.id}`} className="px-2 pt-2 pb-1 text-[length:var(--type-dense)] text-quiet">
              {group.title}
            </p>
            {actions.map((action) => (
              <div
                key={action.key}
                className={cn(rowClass, "aria-disabled:opacity-50")}
                aria-disabled={action.needsMeasure && props.run.chart === null ? true : undefined}
                {...option(rows.indexOf(action))}
              >
                <action.glyph className="size-4" />
                {action.label}
              </div>
            ))}
          </div>
        ))}
        <div role="group" aria-labelledby={`${id}-icons`} data-actions-group="icons">
          <p id={`${id}-icons`} className="px-2 pt-2 pb-1 text-quiet">
            {editorCopy.iconsGroup}
          </p>
          {iconNames.length === 0 ? null : (
            <div className="grid gap-0.5 px-1" style={{ gridTemplateColumns: `repeat(${String(iconColumns)}, 1fr)` }}>
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
          {editorCopy.allIcons}
        </button>
      )}
      <p role="status" className={nothing ? "px-2 py-1 text-quiet" : "sr-only"}>
        {nothing ? editorCopy.noActions : null}
      </p>
    </div>
  )
}
