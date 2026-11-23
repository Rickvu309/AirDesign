import type { KeyboardEvent, RefObject } from "react"
import { PromptInput, PromptInputButton, PromptInputTextarea } from "@/components/ai-elements/prompt-input"
import { airaCopy } from "@/copy/aira-copy"
import { surfaceShadow } from "@/components/ui/shadows"
import { EditorIcon } from "@/components/ui/editor-icons"
import { cn } from "@/lib/class-names"
import { composing } from "@/lib/composing"

const buttonRing = "outline-hidden"

export function AiraComposer({
  draft,
  working,
  blocked,
  field,
  onDraft,
  onSend,
  onStop,
  onFocusChange,
}: {
  draft: string
  working: boolean
  blocked: string | undefined
  field: RefObject<HTMLTextAreaElement | null>
  onDraft: (text: string) => void
  onSend: () => void
  onStop: () => void
  onFocusChange: (focused: boolean) => void
}) {
  const waiting = blocked !== undefined
  const hint = blocked ?? (working ? airaCopy.addToRequest : airaCopy.askAira)
  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (composing(event) || event.key !== "Enter" || event.shiftKey) return
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
        {...(waiting ? {} : { "data-focus-ring": true })}
        className={cn("min-h-12 cursor-text items-end gap-2 py-2 pr-2 pl-3", waiting && "cursor-not-allowed")}
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
          onFocus={() => onFocusChange(true)}
          onBlur={(event) => {
            if (!event.currentTarget.disabled) onFocusChange(false)
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
