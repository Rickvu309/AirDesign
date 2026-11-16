import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { pictureCopy } from "@/copy/picture-copy"
import { EditorIcon } from "@/editor/editor-icons"
import { IconSearch } from "@/editor/icon-search"

export function IconTool({ onIcon }: { readonly onIcon: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={pictureCopy.addIcon}
            className="size-9 rounded-lg text-quiet hover:bg-transparent active:translate-y-0"
          />
        }
      >
        <EditorIcon name="icon" size={18} />
      </PopoverTrigger>
      <PopoverContent side="top" sideOffset={12} className="w-64 duration-0" data-icon-tool data-keeps-format>
        <IconSearch
          label={pictureCopy.addIcon}
          current={null}
          autoFocus
          onPick={(name) => {
            setOpen(false)
            onIcon(name)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
