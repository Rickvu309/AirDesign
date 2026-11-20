import type { ElementId } from "@airdesign/document"
import { Button } from "@/components/ui/button"
import { designCopy } from "@/copy/design-copy"
import type { DesignDeck } from "@/design/design-change"
import { EditorIcon } from "@/editor/editor-icons"
import { resizeFramesToFit } from "@/editor/frame-fit-action"

export function ResizeToFit({ deck, node }: { readonly deck: DesignDeck; readonly node: ElementId }) {
  return (
    <div data-resize-to-fit className="border-b border-line px-4 pb-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2 font-normal"
        onClick={() => resizeFramesToFit(deck, [node])}
      >
        <EditorIcon name="fitFrame" size={16} />
        {designCopy.resizeToFit}
      </Button>
    </div>
  )
}
