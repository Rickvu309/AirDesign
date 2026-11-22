import type { ElementId } from "@airdesign/document"
import { Button } from "@/components/ui/button"
import { designCopy } from "@/copy/design-copy"
import type { DesignDeck } from "@/design/design-change"
import { removeAutoLayout } from "@/editor/auto-layout-removal"
import { EditorIcon } from "@/editor/editor-icons"

export function RemoveAutoLayout({ deck, node }: { readonly deck: DesignDeck; readonly node: ElementId }) {
  return <RemoveAutoLayoutButton onRemove={() => removeAutoLayout(deck, node)} />
}

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
