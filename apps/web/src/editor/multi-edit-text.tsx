import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { designCopy } from "@/copy/design-copy"
import { PassageField } from "@/design/controls/text"
import { EditorIcon } from "@/editor/editor-icons"

export function MultiEditText({ values, onChange }: { values: readonly string[]; onChange: (words: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover
      open={open}
      onOpenChange={(next, details) => {
        if (!next && details.reason === "escape-key") return
        setOpen(next)
      }}
    >
      <PopoverTrigger
        render={
          <Button type="button" variant="ghost" size="icon" className="size-6" aria-label={designCopy.multiEditText} />
        }
      >
        <EditorIcon name="text" size={14} />
      </PopoverTrigger>
      <PopoverContent side="left" align="start" sideOffset={12} data-keeps-selection>
        <PassageField label={designCopy.multiEditText} values={values} rich onChange={onChange} />
      </PopoverContent>
    </Popover>
  )
}
