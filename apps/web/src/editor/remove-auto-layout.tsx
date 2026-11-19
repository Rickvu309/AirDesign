import { changeLayout, type ElementId } from "@airdesign/document"
import { Button } from "@/components/ui/button"
import { designCopy } from "@/copy/design-copy"
import { changeRows, type DesignDeck } from "@/design/design-change"
import { EditorIcon } from "@/editor/editor-icons"

export function RemoveAutoLayout({ deck, node }: { readonly deck: DesignDeck; readonly node: ElementId }) {
  return (
    <div data-auto-layout className="border-b border-line px-4 pb-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2 font-normal"
        onClick={() =>
          changeRows(
            deck,
            (register) => {
              const changed = changeLayout(register, { remove: node })
              return changed === null || !("rows" in changed) ? null : changed.rows
            },
            "remove-auto-layout",
          )
        }
      >
        <EditorIcon name="unframe" size={16} />
        {designCopy.removeAutoLayout}
      </Button>
    </div>
  )
}
