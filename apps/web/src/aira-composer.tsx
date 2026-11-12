import { useRef, type KeyboardEvent } from "react"
import { PromptInput, PromptInputButton, PromptInputTextarea } from "@/components/ai-elements/prompt-input"
import { airaCopy } from "@/copy/aira-copy"
import { surfaceShadow } from "@/editor/editor-chrome"
import { EditorIcon } from "@/editor/editor-icons"
import { cn } from "@/lib/class-names"

const focusRing =
  "focus-within:shadow-[0px_0px_0px_1px_var(--ring),0px_0px_0px_3px_var(--strong-15),0px_2px_8px_var(--black-5)]"

const buttonRing = "outline-hidden focus-visible:shadow-[0px_0px_0px_2px_var(--background),0px_0px_0px_4px_var(--ring)]"

export function AiraComposer({
  draft,
  working,
  blocked,
  onDraft,
  onSend,
  onStop,
}: {
  draft: string
  working: boolean
  blocked: string | undefined
  onDraft: (text: string) => void
  onSend: () => void
  onStop: () => void
}) {
  const field = useRef<HTMLTextAreaElement>(null)
  const composing = useRef(false)
  const waiting = blocked !== undefined
  const hint = blocked ?? (working ? airaCopy.addToRequest : airaCopy.askAira)
  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return
    if (composing.current || event.nativeEvent.isComposing) return
    event.preventDefault()
    onSend()
  }
  return (
    <form
      className="flex shrink-0 flex-col px-3 pb-3"
      onSubmit={(event) => {
        event.preventDefault()
        onSend()
      }}
    >
      <PromptInput
        data-waiting={waiting}
        className={cn(
          "min-h-12 cursor-text items-end gap-2 py-2 pr-2 pl-3 [transition:box-shadow_var(--ease-micro)] motion-reduce:transition-none",
          waiting ? "cursor-not-allowed" : focusRing,
        )}
        onClick={() => field.current?.focus()}
      >
        <PromptInputTextarea
          ref={field}
          aria-label={hint}
          placeholder={hint}
          value={draft}
          disabled={waiting}
          className="py-1.5 outline-hidden placeholder:text-muted-foreground"
          onChange={(event) => onDraft(event.target.value)}
          onKeyDown={onKey}
          onCompositionStart={() => {
            composing.current = true
          }}
          onCompositionEnd={() => {
            composing.current = false
          }}
        />
        <span className="flex h-8 shrink-0 items-center">
          {working ? (
            <PromptInputButton
              className={cn("size-7 rounded-full bg-ink", buttonRing)}
              aria-label="Stop"
              onClick={onStop}
            >
              <span className="block size-2.5 rounded-[2px] bg-white" />
            </PromptInputButton>
          ) : (
            <PromptInputButton
              type="submit"
              className={cn(
                "size-8 rounded-full bg-white text-foreground disabled:cursor-not-allowed disabled:opacity-40",
                surfaceShadow,
                buttonRing,
              )}
              aria-label="Send"
              disabled={waiting || draft.trim() === ""}
            >
              <EditorIcon name="up" size={16} />
            </PromptInputButton>
          )}
        </span>
      </PromptInput>
    </form>
  )
}
