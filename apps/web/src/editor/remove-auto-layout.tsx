import { Button } from "@/components/ui/button"
import { designCopy } from "@/copy/design-copy"
import { EditorIcon } from "@/components/ui/editor-icons"

export function RemoveAutoLayoutButton({ onRemove }: { readonly onRemove: () => void }) {
  return (
    <div data-auto-layout className="border-b border-line px-4 pb-3">
      <Button type="button" variant="outline" size="sm" className="w-full gap-2 font-normal" onClick={onRemove}>
        <EditorIcon name="unframe" size={16} />
        {designCopy.removeAutoLayout}
      </Button>
    </div>
  )
}
