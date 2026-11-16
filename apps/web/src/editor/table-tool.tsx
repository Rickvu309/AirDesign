import { useRef, useState, type KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { tableCopy } from "@/copy/table-copy"
import type { TableSize } from "@/element-edit"
import { floatShadow } from "@/editor/editor-chrome"
import { EditorIcon } from "@/editor/editor-icons"
import { cn } from "@/lib/class-names"
import { counts, first, most, movedSize } from "@/editor/table-size"

export function TableSizeGrid({
  picked,
  onPick,
  onSize,
}: {
  picked: TableSize
  onPick: (size: TableSize) => void
  onSize: (size: TableSize) => void
}) {
  const grid = useRef<HTMLDivElement>(null)

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = movedSize(picked, event.key)
    if (next === null) return
    event.preventDefault()
    onPick(next)
    grid.current?.querySelector<HTMLElement>(`[data-size="${String(next.rows)}.${String(next.columns)}"]`)?.focus()
  }

  return (
    <div
      className={cn("flex flex-col gap-2 rounded-xl bg-white p-3 text-[length:var(--type-dense)]", floatShadow)}
      data-table-picker
    >
      <span className="text-foreground" aria-live="polite">
        {tableCopy.sizeOf(picked.rows, picked.columns)}
      </span>
      <div
        ref={grid}
        role="group"
        aria-label={tableCopy.size}
        className="grid grid-cols-10 gap-1.5"
        onKeyDown={onKeyDown}
      >
        {counts(most.rows).flatMap((row) =>
          counts(most.columns).map((column) => {
            const inside = row <= picked.rows && column <= picked.columns
            const size = { rows: row, columns: column }
            return (
              <button
                key={`${String(row)}.${String(column)}`}
                type="button"
                aria-label={tableCopy.sizeOf(row, column)}
                data-size={`${String(row)}.${String(column)}`}
                data-picked={inside ? "" : undefined}
                tabIndex={row === picked.rows && column === picked.columns ? 0 : -1}
                className={cn(
                  "size-4.5 rounded-xs border",
                  inside ? "border-primary bg-primary/15" : "border-[var(--field-edge)] bg-white",
                )}
                onPointerEnter={() => onPick(size)}
                onClick={() => onSize(size)}
              />
            )
          }),
        )}
      </div>
    </div>
  )
}

export function TableTool({ onTable }: { onTable: (size: TableSize) => void }) {
  const [open, setOpen] = useState(false)
  const opened = useRef(false)
  const [picked, setPicked] = useState<TableSize>(first)
  const change = (next: boolean) => {
    opened.current = next
    setOpen(next)
    setPicked(first)
  }
  const insert = (size: TableSize) => {
    change(false)
    onTable(size)
  }
  const earlyKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const key = event.key
    if (!opened.current || movedSize(first, key) === null) return
    event.preventDefault()
    setPicked((at) => movedSize(at, key) ?? at)
  }
  return (
    <Popover open={open} onOpenChange={change}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={tableCopy.tool}
            onKeyDown={earlyKey}
            className="size-9 rounded-lg text-quiet hover:bg-transparent active:translate-y-0 data-[popup-open]:bg-primary data-[popup-open]:text-primary-foreground"
          />
        }
      >
        <EditorIcon name="table" size={18} />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={12}
        className="w-auto bg-transparent p-0 shadow-none ring-0 duration-0"
        data-keeps-format
      >
        <TableSizeGrid picked={picked} onPick={setPicked} onSize={insert} />
      </PopoverContent>
    </Popover>
  )
}
