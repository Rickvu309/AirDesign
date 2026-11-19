import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { textCopy } from "@/copy/text-copy"
import { ChoiceControl } from "./choice"
import type { ControlProps } from "../panel"

export function TypeSettings(props: ControlProps) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={textCopy.settings}
        render={<Button type="button" size="sm" variant="outline" className="w-full" />}
      >
        {textCopy.settings}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52" data-keeps-format data-keeps-selection>
        <PopoverTitle>{textCopy.settings}</PopoverTitle>
        <ChoiceControl {...props} />
      </PopoverContent>
    </Popover>
  )
}
