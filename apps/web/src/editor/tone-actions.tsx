import { useRef, useState, useSyncExternalStore, type MouseEvent } from "react"
import type { ElementId } from "@airdesign/document"
import type { TextFormatting } from "@airdesign/render"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { adjustToneCopy } from "@/copy/adjust-tone-copy"
import { toolbarCopy } from "@/copy/toolbar-copy"
import { AdjustTone } from "@/editor/adjust-tone"
import { ToneIcon } from "@/editor/editor-icons"
import { EditorMenuAction, EditorMenuContent, EditorMenuSub } from "@/editor/editor-menu"
import type { ToneSource } from "@/editor/tone-link"

function holdCaret(event: MouseEvent) {
  event.preventDefault()
}

function ToneActionsFor({ node, source }: { node: ElementId; source: ToneSource }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [toneOpen, setToneOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const toneFor = useSyncExternalStore(source.link.subscribe, source.link.current, noTone)
  const scope = toneFor === null ? null : source.scope(node)
  if (toneFor === null || scope === null) return null
  return (
    <>
      <DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              ref={anchor}
              type="button"
              variant="ghost"
              size="icon"
              aria-label={toolbarCopy.actions}
              className="size-9 rounded-lg text-quiet hover:bg-transparent active:translate-y-0 aria-expanded:bg-line aria-expanded:text-foreground"
              onMouseDown={holdCaret}
            />
          }
        >
          <ToneIcon size={18} />
        </DropdownMenuTrigger>
        <EditorMenuContent side="top" align="end" sideOffset={12} data-keeps-format>
          <EditorMenuSub label={toolbarCopy.rewriteThis}>
            <EditorMenuAction label={adjustToneCopy.title} onClick={() => setToneOpen(true)} />
          </EditorMenuSub>
        </EditorMenuContent>
      </DropdownMenu>
      <AdjustTone
        key={`${scope.slide} ${node}`}
        action={toneFor(scope)}
        opening={{ open: toneOpen, onOpenChange: setToneOpen, anchor }}
      />
    </>
  )
}

function unsubscribed(): () => void {
  return () => undefined
}

function noTone(): null {
  return null
}

export function useToneReady(source: ToneSource | undefined): boolean {
  return useSyncExternalStore(source?.link.subscribe ?? unsubscribed, source?.link.current ?? noTone, noTone) !== null
}

export function ToneActions({ formatting, source }: { formatting: TextFormatting; source: ToneSource }) {
  const node = useSyncExternalStore(formatting.subscribe, formatting.aimed, noTone)
  return node === null ? null : <ToneActionsFor key={node} node={node} source={source} />
}
