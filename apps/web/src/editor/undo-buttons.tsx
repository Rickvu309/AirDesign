import { Button } from "@/components/ui/button"
import { undoCopy } from "@/copy/undo-copy"
import { EditorIcon } from "@/editor/editor-icons"

export type UndoButtonsState = {
  readonly undoLabel: string
  readonly redoLabel: string
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly onUndo: () => void
  readonly onRedo: () => void
}

const look = "size-9 rounded-lg text-quiet hover:bg-transparent active:translate-y-0 disabled:text-faint"

export function UndoButtons({ state }: { state?: UndoButtonsState }) {
  return (
    <span className="flex items-center gap-0.5" data-undo-buttons>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={state?.undoLabel ?? undoCopy.undo}
        disabled={state !== undefined && !state.canUndo}
        className={look}
        {...(state === undefined ? {} : { onClick: state.onUndo })}
      >
        <EditorIcon name="undo" size={18} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={state?.redoLabel ?? undoCopy.redo}
        disabled={state !== undefined && !state.canRedo}
        className={look}
        {...(state === undefined ? {} : { onClick: state.onRedo })}
      >
        <EditorIcon name="redo" size={18} />
      </Button>
    </span>
  )
}
