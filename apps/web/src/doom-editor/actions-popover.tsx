import { ChartBar, ChartColumn, ChartLine, ChartNoAxesColumn, ChartPie, Search } from "lucide-react"
import { DynamicIcon, type IconName } from "lucide-react/dynamic"
import { useId, useMemo, useState, type ComponentType, type ReactNode } from "react"
import { doomEditorCopy } from "@/copy/doom-editor-copy"
import { iconMatches, startingIcons } from "@/design/icon-search"
import { cn } from "@/lib/class-names"
import * as doom from "@airdesign/doom"

export type ActionRun = {
  readonly chart: (kind: doom.Chart["kind"]) => void
  readonly icon: (name: string) => void
}

type Group = {
  readonly id: string
  readonly title: string
  readonly render: (query: string, run: ActionRun, finish: () => void) => ReactNode
}

const charts: readonly { readonly kind: doom.Chart["kind"]; readonly icon: ComponentType<{ className?: string }> }[] = [
  { kind: "column", icon: ChartColumn },
  { kind: "bar", icon: ChartBar },
  { kind: "line", icon: ChartLine },
  { kind: "pie", icon: ChartPie },
  { kind: "stacked", icon: ChartNoAxesColumn },
]

const rowClass =
  "flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-[length:var(--type-dense)] hover:bg-muted"

function IconGrid({
  names,
  run,
  finish,
}: {
  readonly names: readonly string[]
  readonly run: ActionRun
  readonly finish: () => void
}) {
  return (
    <div role="group" aria-label={doomEditorCopy.iconsGroup} className="grid grid-cols-8 gap-0.5 px-1">
      {names.map((name) => (
        <button
          key={name}
          type="button"
          aria-label={name}
          title={name}
          className="flex size-8 items-center justify-center rounded-md hover:bg-muted"
          onClick={() => {
            run.icon(name)
            finish()
          }}
        >
          <DynamicIcon name={name as IconName} size={18} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

const chartsGroup: Group = {
  id: "charts",
  title: doomEditorCopy.chartsGroup,
  render(query, run, finish) {
    const words = query.trim().toLowerCase()
    const found = charts.filter(
      ({ kind }) =>
        words === "" || doomEditorCopy.chartKinds[kind].toLowerCase().includes(words) || "chart".includes(words),
    )
    if (found.length === 0) return null
    return (
      <div>
        {found.map(({ kind, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            className={rowClass}
            onClick={() => {
              run.chart(kind)
              finish()
            }}
          >
            <Icon className="size-4" />
            {doomEditorCopy.chartKinds[kind]}
          </button>
        ))}
      </div>
    )
  },
}

const actionGroups: readonly Group[] = [chartsGroup]

export function ActionsPanel(props: { readonly run: ActionRun; readonly finish: () => void }) {
  const id = useId()
  const [query, setQuery] = useState("")
  const [all, setAll] = useState(false)
  const words = query.trim()
  const names = useMemo(() => (words === "" ? startingIcons.slice(0, 8) : iconMatches(words, 32)), [words])
  const iconNames = all && words === "" ? iconMatches("", 24) : names
  const sections = all
    ? []
    : actionGroups
        .map((group) => ({ group, shown: group.render(query, props.run, props.finish) }))
        .filter((each) => each.shown !== null)
  const nothing = sections.length === 0 && iconNames.length === 0
  return (
    <div className="flex flex-col gap-1 text-[length:var(--type-dense)]" data-actions-panel="">
      <label htmlFor={id} className="sr-only">
        {doomEditorCopy.actionsSearch}
      </label>
      <div data-focus-ring className="flex items-center gap-2 rounded-lg bg-muted px-2.5">
        <Search className="size-3.5 shrink-0 text-quiet" />
        <input
          id={id}
          type="search"
          autoFocus
          placeholder={doomEditorCopy.actionsSearch}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-8 w-full min-w-0 bg-transparent text-[length:var(--type-dense)] outline-none placeholder:text-quiet"
        />
      </div>
      {sections.map(({ group, shown }) => (
        <div key={group.id} data-actions-group={group.id}>
          <p className="px-2 pt-2 pb-1 text-[length:var(--type-dense)] text-quiet">{group.title}</p>
          {shown}
        </div>
      ))}
      <div data-actions-group="icons">
        <p className="px-2 pt-2 pb-1 text-quiet">{doomEditorCopy.iconsGroup}</p>
        {iconNames.length === 0 ? null : <IconGrid names={iconNames} run={props.run} finish={props.finish} />}
        {all ? null : (
          <button type="button" className={cn(rowClass, "text-quiet")} onClick={() => setAll(true)}>
            {doomEditorCopy.allIcons}
          </button>
        )}
      </div>
      {nothing ? <p className="px-2 py-1 text-quiet">{doomEditorCopy.noActions}</p> : null}
    </div>
  )
}
