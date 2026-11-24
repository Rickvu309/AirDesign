import { useState, type KeyboardEvent } from "react"
import { PromptInput, PromptInputButton, PromptInputTextarea } from "@/components/ai-elements/prompt-input"
import { EditorIcon } from "@/components/ui/editor-icons"
import { surfaceShadow } from "@/components/ui/shadows"
import { productCopy } from "@/copy/product-copy"
import { cn } from "@/lib/class-names"
import { composing } from "@/lib/composing"

export function DescribeDeck({ onDescribe }: { readonly onDescribe: (text: string) => void }) {
  const [text, setText] = useState("")
  const ready = text.trim() !== ""
  function send() {
    if (ready) onDescribe(text.trim())
  }
  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (composing(event) || event.key !== "Enter" || event.shiftKey) return
    event.preventDefault()
    send()
  }
  return (
    <form
      data-describe-deck
      className="mt-6"
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
    >
      <PromptInput data-focus-ring className="min-h-12 cursor-text items-end gap-2 py-2 pr-2 pl-3">
        <PromptInputTextarea
          aria-label={productCopy.describeDeck}
          placeholder={productCopy.describeDeckExample}
          value={text}
          className="py-1.5 outline-hidden placeholder:text-muted-foreground"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKey}
        />
        <span className="flex h-8 shrink-0 items-center">
          <PromptInputButton
            type="submit"
            className={cn(
              "size-8 rounded-full bg-white text-foreground outline-hidden disabled:cursor-not-allowed disabled:opacity-40",
              surfaceShadow,
            )}
            aria-label={productCopy.makeDeck}
            disabled={!ready}
          >
            <EditorIcon name="up" size={16} />
          </PromptInputButton>
        </span>
      </PromptInput>
    </form>
  )
}
