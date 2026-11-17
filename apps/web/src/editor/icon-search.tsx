import { iconNames } from "@airdesign/catalog"
import { DynamicIcon, type IconName } from "lucide-react/dynamic"
import { useId, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { pictureCopy } from "@/copy/picture-copy"
import { cn } from "@/lib/class-names"

const shownCount = 24
const startingCount = 12

export const startingIcons: readonly string[] = [
  "rocket",
  "lightbulb",
  "star",
  "heart",
  "target",
  "trophy",
  "users",
  "globe",
  "shield-check",
  "clock",
  "calendar",
  "mail",
  "phone",
  "map-pin",
  "chart-line",
  "chart-pie",
  "settings",
  "zap",
  "check",
  "leaf",
  "cloud",
  "lock",
  "search",
  "flag",
]

export function iconMatches(query: string, most = shownCount): readonly string[] {
  const words = query.trim().toLowerCase()
  if (words === "") return startingIcons.slice(0, Math.min(most, startingCount))
  const found = iconNames.filter((name) => words.split(/\s+/).every((word) => name.includes(word)))
  const first = found.filter((name) => name.startsWith(words.split(/\s+/)[0] ?? ""))
  return [...new Set([...first, ...found])].slice(0, most)
}

export function IconSearch(props: {
  readonly label: string
  readonly current: string | null
  readonly onPick: (name: string) => void
  readonly autoFocus?: boolean
  readonly waits?: boolean
}) {
  const id = useId()
  const [query, setQuery] = useState("")
  const found = useMemo(
    () => (props.waits === true && query.trim() === "" ? [] : iconMatches(query)),
    [props.waits, query],
  )
  return (
    <div className="flex flex-col gap-2" data-icon-search>
      <label htmlFor={id} className="sr-only">
        {pictureCopy.search}
      </label>
      <Input
        id={id}
        type="search"
        autoFocus={props.autoFocus}
        placeholder={pictureCopy.searchHint}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-8 bg-white text-[length:var(--type-dense)] md:text-[length:var(--type-dense)]"
      />
      {found.length === 0 && query.trim() === "" ? null : found.length === 0 ? (
        <p className="text-[length:var(--type-dense)] text-quiet" role="status">
          {pictureCopy.noIcons}
        </p>
      ) : (
        <div role="group" aria-label={props.label} className="grid grid-cols-6 gap-1">
          {found.map((name) => (
            <Button
              key={name}
              type="button"
              variant="ghost"
              size="icon"
              aria-label={name}
              aria-pressed={name === props.current}
              title={name}
              onClick={() => props.onPick(name)}
              className={cn(
                "size-8 rounded-md active:translate-y-0",
                name === props.current ? "bg-line hover:bg-line" : "text-foreground hover:bg-canvas",
              )}
            >
              <DynamicIcon name={name as IconName} size={18} aria-hidden="true" />
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
