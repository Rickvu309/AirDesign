import { useId } from "react"
import { Button } from "@/components/ui/button"
import { designCopy } from "@/copy/design-copy"
import { EditorIcon } from "@/components/ui/editor-icons"

export function RemoveAutoLayoutButton({
  onRemove,
  reason,
}: {
  readonly onRemove: (() => void) | undefined
  readonly reason: string | undefined
}) {
  const reasonId = useId()
  return (
    <div data-auto-layout className="border-b border-line px-4 pb-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2 font-normal aria-disabled:opacity-50"
        aria-describedby={reason === undefined ? undefined : reasonId}
        focusableWhenDisabled
        onClick={onRemove}
        disabled={onRemove === undefined}
      >
        <EditorIcon name="unframe" size={16} />
        {designCopy.removeAutoLayout}
      </Button>
      <p id={reasonId} role="status" className="mt-1.5 text-xs text-muted-foreground empty:sr-only">
        {reason}
      </p>
    </div>
  )
}
