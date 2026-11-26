import type { Ref } from "react"
import { Button } from "@/components/ui/button"
import { presentCopy } from "@/copy/present-copy"
import { EditorIcon } from "@/components/ui/editor-icons"

export function PresentButton({ onClick, ref }: { onClick?: () => void; ref?: Ref<HTMLButtonElement> }) {
  return (
    <Button
      {...(ref === undefined ? {} : { ref })}
      type="button"
      variant="ghost"
      size="icon"
      aria-label={presentCopy.present}
      aria-keyshortcuts="Meta+Enter Control+Enter F5"
      data-present-button
      className="active:translate-y-0"
      {...(onClick === undefined ? {} : { onClick })}
    >
      <EditorIcon name="play" size={16} />
    </Button>
  )
}
