import { gestures, type GestureRow } from "@airdesign/render"
import { X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { shortcutCopy } from "@/copy/shortcut-copy"
import { keyPlatform, shortcutCaps } from "@/editor/shortcut-text"
import { cn } from "@/lib/class-names"

type GestureGroup = GestureRow["group"]

const groupOrder: readonly GestureGroup[] = [
  "select",
  "move",
  "size",
  "arrange",
  "tools",
  "text",
  "view",
  "slides",
  "present",
  "history",
]

export function ShortcutsPanel({ onClose, agent = navigator.userAgent }: { onClose: () => void; agent?: string }) {
  const platform = keyPlatform(agent)
  const [group, setGroup] = useState<GestureGroup>("select")
  const rows = gestures.filter((row) => row.group === group)
  return (
    <section
      aria-label={shortcutCopy.title}
      data-shortcuts-panel
      className="flex h-[var(--shortcuts-panel-height)] shrink-0 flex-col bg-foreground text-white"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.nativeEvent.isComposing) return
        event.preventDefault()
        onClose()
      }}
    >
      <div className="flex h-11 shrink-0 items-center gap-4 border-b border-[var(--stage-hover)] pr-2 pl-4">
        <h2 className="shrink-0 text-[length:var(--type-dense)] font-medium">{shortcutCopy.title}</h2>
        <div className="flex min-w-0 gap-0.5 overflow-x-auto" role="group" aria-label={shortcutCopy.title}>
          {groupOrder.map((each) => (
            <button
              key={each}
              type="button"
              aria-pressed={each === group}
              data-shortcuts-group={each}
              className={cn(
                "h-7 shrink-0 rounded-[var(--shape-control)] px-2.5 text-[length:var(--type-caption)]",
                each === group ? "bg-[var(--stage-hover)] text-white" : "text-[var(--stage-quiet)] hover:text-white",
              )}
              onClick={() => setGroup(each)}
            >
              {shortcutCopy.groups[each]}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={shortcutCopy.close}
          className="ml-auto text-[var(--stage-quiet)] hover:bg-[var(--stage-hover)] hover:text-white"
          onClick={onClose}
        >
          <X aria-hidden />
        </Button>
      </div>
      <ul
        aria-label={shortcutCopy.groups[group]}
        className="min-h-0 flex-1 columns-[18rem] gap-x-10 overflow-y-auto px-4 py-2"
      >
        {rows.map((row) => (
          <li
            key={row.id}
            data-shortcut={row.id}
            className="flex break-inside-avoid items-center justify-between gap-4 py-1.5 text-[length:var(--type-dense)]"
          >
            <span className="min-w-0 flex-1">{shortcutCopy.gestures[row.id]}</span>
            <span className="flex max-w-3/5 flex-wrap items-center justify-end gap-x-2 gap-y-1">
              {shortcutCaps(row, platform)
                .slice(0, row.keys.length === 0 ? 1 : 2)
                .map((caps) => (
                  <span key={caps.join(" ")} className="flex items-center gap-0.5">
                    {caps.map((cap) => (
                      <kbd
                        key={cap}
                        className="min-w-6 rounded-[var(--shape-segment)] px-1.5 text-center font-sans text-[length:var(--type-caption)] leading-6 text-[var(--stage-quiet)] shadow-[inset_0_0_0_1px_var(--stage-hover)]"
                      >
                        {cap}
                      </kbd>
                    ))}
                  </span>
                ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
