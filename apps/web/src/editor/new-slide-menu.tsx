import type { ReactNode } from "react"
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EditorIcon } from "@/editor/editor-icons"
import { EditorMenuContent } from "@/editor/editor-menu"
import type { LayoutChoice } from "@/editing/slide-layout"

const label = "flex flex-1 items-center justify-center gap-1 text-[length:var(--type-dense)] text-foreground"

function Label(): ReactNode {
  return (
    <>
      New slide
      <EditorIcon name="chev" size={13} className="text-quiet" />
    </>
  )
}

export function NewSlideMenu({
  layouts,
  onChoose,
}: {
  layouts: readonly LayoutChoice[]
  onChoose: (part: string) => void
}) {
  if (layouts.length === 0) {
    return (
      <span className={label}>
        <Label />
      </span>
    )
  }
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className={`${label} h-7 rounded-l-lg hover:bg-black/4`}
        aria-label="Choose a layout for the new slide"
        data-new-slide-layouts
      >
        <Label />
      </DropdownMenuTrigger>
      <EditorMenuContent side="bottom" align="start" sideOffset={4}>
        {layouts.map((layout) => (
          <DropdownMenuItem
            key={layout.part}
            data-layout={layout.part}
            onClick={() => onChoose(layout.part)}
            className="h-8 gap-2.5 rounded-md py-0 pr-2.5 pl-2 text-[length:var(--type-dense)] text-white focus:bg-quiet focus:text-white focus:**:text-white"
          >
            <span className="min-w-0 flex-1 truncate">{layout.name}</span>
          </DropdownMenuItem>
        ))}
      </EditorMenuContent>
    </DropdownMenu>
  )
}
