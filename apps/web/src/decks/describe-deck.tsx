import { useRef, useState, type KeyboardEvent } from "react"
import { PromptInput, PromptInputTextarea } from "@/components/ai-elements/prompt-input"
import { Button } from "@/components/ui/button"
import { EditorIcon } from "@/components/ui/editor-icons"
import { surfaceShadow } from "@/components/ui/shadows"
import { productCopy } from "@/copy/product-copy"
import { storyIdeasAt } from "@/copy/story-ideas-copy"
import { cn } from "@/lib/class-names"
import { composing } from "@/lib/composing"

const idea =
  "flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-background pr-3 pl-2.5 text-[length:var(--type-dense)] text-quiet hover:text-foreground"

export function DescribeDeck({
  initial = "",
  onDescribe,
}: {
  readonly initial?: string
  readonly onDescribe: (text: string) => void
}) {
  const [text, setText] = useState(initial)
  const [round, setRound] = useState(0)
  const field = useRef<HTMLTextAreaElement>(null)
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
      className="w-full max-w-180 rounded-[calc(var(--shape-dialog)+4px)] bg-canvas p-1 shadow-[inset_0_0_0_1px_var(--line)]"
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
    >
      <PromptInput className="min-h-31 cursor-text flex-col gap-2 pt-4 pr-2.5 pb-2.5 pl-4.5">
        <PromptInputTextarea
          ref={field}
          aria-label={productCopy.describeDeck}
          placeholder={productCopy.describeDeckExample}
          value={text}
          data-focus-edge
          className="min-h-12 text-[length:var(--type-field)] outline-hidden placeholder:text-[color:var(--placeholder-prompt)]"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKey}
        />
        <span className="flex shrink-0 justify-end">
          <Button
            type="submit"
            variant="signature"
            size="icon"
            className="rounded-full disabled:cursor-not-allowed"
            aria-label={productCopy.makeDeck}
            disabled={!ready}
          >
            <EditorIcon name="up" size={16} />
          </Button>
        </span>
      </PromptInput>
      <div className="flex flex-wrap items-center gap-1.5 py-2 pr-1.5 pl-2">
        {storyIdeasAt(round).map((each) => (
          <button
            key={each.words}
            type="button"
            data-story-idea
            className={cn(idea, surfaceShadow)}
            onClick={() => {
              setText(each.words)
              field.current?.focus()
            }}
          >
            <span className="contents text-primary">
              <EditorIcon name={each.icon} size={13} />
            </span>
            {each.words}
          </button>
        ))}
        <button
          type="button"
          className="ml-auto flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2 text-[length:var(--type-caption)] text-muted-foreground hover:text-foreground"
          onClick={() => setRound(round + 1)}
        >
          <EditorIcon name="restart" size={13} />
          {productCopy.moreIdeas}
        </button>
      </div>
    </form>
  )
}
