import { formatNames, type FormatState, type TextFormat } from "@airdesign/document"
import type { TextFormatting } from "@airdesign/render"
import { useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"
import { formatCopy } from "@/copy/format-copy"
import { EditorIcon } from "@/editor/editor-icons"
import { cn } from "@/lib/class-names"

export type FormatShown = Readonly<Record<TextFormat, FormatState>>

const keys: Readonly<Record<TextFormat, string>> = { bold: "B", italic: "I", underline: "U" }

const looks: Readonly<Record<FormatState, string>> = {
  on: "bg-line text-foreground hover:bg-line",
  mixed: "bg-canvas text-foreground hover:bg-canvas",
  off: "text-quiet hover:bg-transparent",
}

const pressed: Readonly<Record<FormatState, "true" | "false" | "mixed">> = { on: "true", off: "false", mixed: "mixed" }

export function FormatButtons({ shown, onToggle }: { shown: FormatShown; onToggle?: (format: TextFormat) => void }) {
  return (
    <>
      <span className="mx-1 block h-6 w-px bg-[var(--field-edge)]" />
      <span role="group" aria-label={formatCopy.group} className="flex items-center gap-0.5" data-text-format>
        {formatNames.map((format) => (
          <Button
            key={format}
            type="button"
            variant="ghost"
            size="icon"
            aria-label={formatCopy.named[format]}
            aria-pressed={pressed[shown[format]]}
            aria-keyshortcuts={`Control+${keys[format]} Meta+${keys[format]}`}
            className={cn("size-9 rounded-lg active:translate-y-0", looks[shown[format]])}
            onMouseDown={(event) => event.preventDefault()}
            {...(onToggle === undefined ? {} : { onClick: () => onToggle(format) })}
          >
            <EditorIcon name={format} size={18} />
          </Button>
        ))}
      </span>
    </>
  )
}

function shownOf(formatting: TextFormatting): FormatShown | null {
  const bold = formatting.state("bold")
  const italic = formatting.state("italic")
  const underline = formatting.state("underline")
  return bold === null || italic === null || underline === null ? null : { bold, italic, underline }
}

export function LiveFormatButtons({ formatting }: { formatting: TextFormatting }) {
  useSyncExternalStore(formatting.subscribe, formatting.version)
  const shown = shownOf(formatting)
  return shown === null ? null : <FormatButtons shown={shown} onToggle={formatting.toggle} />
}
