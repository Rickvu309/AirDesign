import type { Ref } from "react"
import { Button } from "@/components/ui/button"
import { presentCopy } from "@/copy/present-copy"
import { EditorIcon } from "@/editor/editor-icons"
import { cn } from "@/lib/class-names"

export function PresentButton({
  faded = false,
  onClick,
  ref,
}: {
  faded?: boolean
  onClick?: () => void
  ref?: Ref<HTMLButtonElement>
}) {
  return (
    <Button
      {...(ref === undefined ? {} : { ref })}
      type="button"
      variant="ghost"
      size="icon"
      aria-label={presentCopy.present}
      aria-keyshortcuts="Meta+Enter Control+Enter F5"
      data-present-button
      className={cn("size-8 rounded-lg text-foreground active:translate-y-0", faded && "opacity-40")}
      {...(onClick === undefined ? {} : { onClick })}
    >
      <EditorIcon name="play" size={16} />
    </Button>
  )
}
