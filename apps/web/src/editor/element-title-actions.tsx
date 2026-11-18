import type { ElementId } from "@airdesign/document"
import type { PanelModel } from "@/design/panel"
import { ImageUp, ScanSearch } from "lucide-react"
import { Button } from "@/components/ui/button"
import { designCopy } from "@/copy/design-copy"
import { pictureCopy } from "@/copy/picture-copy"
import { pickPicture } from "@/editor/picture-picker"

export function ElementTitleActions({
  onMatch,
  onReplace,
  model,
}: {
  onMatch: (() => void) | undefined
  onReplace?: ((node: ElementId, file: File) => void) | undefined
  model?: PanelModel
}) {
  if (onMatch === undefined && onReplace === undefined) return null
  const canReplace =
    model?.kind === "picture" &&
    model.sections.some((section) =>
      section.strips.some((strip) => strip.some(({ trait, field }) => trait === "image" && field === "source")),
    )
  return (
    <div className="flex items-center gap-1">
      {onMatch === undefined ? null : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label={designCopy.selectMatching}
          aria-keyshortcuts="Alt+Control+A Alt+Meta+A"
          title={designCopy.selectMatching}
          onClick={onMatch}
        >
          <ScanSearch aria-hidden className="size-3.5" />
        </Button>
      )}
      {onReplace === undefined || !canReplace ? null : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label={pictureCopy.replace}
          title={pictureCopy.replace}
          onClick={() => pickPicture((file) => onReplace(model.node, file))}
        >
          <ImageUp aria-hidden className="size-3.5" />
        </Button>
      )}
    </div>
  )
}
