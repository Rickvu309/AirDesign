import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation"
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input"
import { productCopy, usageResetsOn } from "@/copy/product-copy"
import { creditsCopy } from "@/credits/credits-sample"
import { UsageRing } from "@/editor/agent-panel"
import { surfaceShadow } from "@/editor/editor-chrome"
import { EditorIcon } from "@/editor/editor-icons"
import { cn } from "@/lib/class-names"
import { airaChat, askAira, undoExchange, type AiraChat } from "@/aira-loop"
import { Asked, ExchangeView, UsagePop } from "@/aira-reply"
import { resetsWhen, usagePercent } from "@/aira-usage"
import { signInAddress } from "@/thin-notice"

function Composer({
  draft,
  working,
  limit,
  onDraft,
  onSend,
  onStop,
}: {
  draft: string
  working: boolean
  limit: string | undefined
  onDraft: (text: string) => void
  onSend: () => void
  onStop: () => void
}) {
  const hint = limit ?? (working ? "Add to the request" : creditsCopy.askAira)
  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    onSend()
  }
  return (
    <div className="flex flex-col px-3 pb-3">
      <PromptInput className="min-h-12 items-center gap-2 py-2 pr-2 pl-3">
        <PromptInputBody>
          <PromptInputTextarea
            aria-label={hint}
            placeholder={hint}
            value={draft}
            disabled={limit !== undefined}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={onKey}
          />
        </PromptInputBody>
        {working ? (
          <PromptInputButton className="size-7 rounded-full bg-ink" aria-label="Stop" onClick={onStop}>
            <span className="block size-2.5 rounded-[2px] bg-white" />
          </PromptInputButton>
        ) : (
          <PromptInputButton
            className={cn("size-8 rounded-full bg-white text-foreground disabled:opacity-40", surfaceShadow)}
            aria-label="Send"
            disabled={limit !== undefined || draft.trim() === ""}
            onClick={onSend}
          >
            <EditorIcon name="up" size={16} />
          </PromptInputButton>
        )}
      </PromptInput>
    </div>
  )
}

export function AiraPanel({ deck, hidden }: { deck: string; hidden: boolean }) {
  const [chat, setChat] = useState(() => airaChat(deck))
  const [draft, setDraft] = useState("")
  const [queued, setQueued] = useState<readonly string[]>([])
  const [usageOpen, setUsageOpen] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const latest = useRef(chat)
  const waiting = useRef<string[]>([])
  const stopper = useRef<AbortController | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const popId = useId()
  const last = chat.exchanges.at(-1)
  const working = last?.end === "working"
  const usage = chat.usage
  const limit = last?.end === "out-of-usage" && usage !== null ? usageResetsOn(resetsWhen(usage.resets)) : undefined

  useEffect(() => () => stopper.current?.abort(), [])

  useEffect(() => {
    const box = scroller.current
    if (box !== null) box.scrollTop = box.scrollHeight
  }, [chat, queued])

  function shown(next: AiraChat) {
    latest.current = next
    setChat(next)
  }

  function takeQueued(): string | undefined {
    const text = waiting.current.splice(0).join("\n")
    setQueued([])
    return text === "" ? undefined : text
  }

  async function run(text: string) {
    const controller = new AbortController()
    stopper.current = controller
    const done = await askAira(latest.current, text, { signal: controller.signal, show: shown, added: takeQueued })
    if (stopper.current === controller) stopper.current = null
    shown(done)
    const end = done.exchanges.at(-1)?.end
    if (end === "signed-out") {
      window.location.assign(signInAddress(window.location))
      return
    }
    const left = takeQueued()
    if (left === undefined) return
    if (end === "done") void run(left)
    else setDraft((now) => (now === "" ? left : `${left}\n${now}`))
  }

  function send() {
    const text = draft.trim()
    if (text === "" || limit !== undefined || undoing) return
    setDraft("")
    if (!working) {
      void run(text)
      return
    }
    waiting.current.push(text)
    setQueued([...waiting.current])
  }

  async function undo(exchange: number) {
    setUndoing(true)
    const next = await undoExchange(latest.current, exchange)
    setUndoing(false)
    if (next !== undefined) shown(next)
  }

  function newChat() {
    waiting.current = []
    setQueued([])
    setUsageOpen(false)
    shown({ ...airaChat(deck), usage: latest.current.usage })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" hidden={hidden} data-aira-panel>
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 pr-3 pl-4">
        <span className="min-w-0 truncate text-xs text-quiet">{chat.exchanges[0]?.asked ?? productCopy.agentName}</span>
        <span className="flex shrink-0 items-center gap-0.5">
          {usage === null ? null : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={productCopy.usageTitle}
              aria-expanded={usageOpen}
              aria-controls={popId}
              className={cn("size-6 rounded-[var(--shape-control)] active:translate-y-0", usageOpen && "bg-line")}
              onClick={() => setUsageOpen((open) => !open)}
            >
              <UsageRing fraction={usagePercent(usage) / 100} />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 rounded-md text-quiet active:translate-y-0"
            aria-label={creditsCopy.newChat}
            disabled={working || undoing}
            onClick={newChat}
          >
            <EditorIcon name="pen" size={15} />
          </Button>
        </span>
      </div>
      <Conversation ref={scroller} className="overflow-y-auto">
        <ConversationContent className="pb-4">
          {chat.exchanges.map((exchange, index) => (
            <ExchangeView
              key={index}
              exchange={exchange}
              resets={usage?.resets}
              onUndo={working || undoing ? undefined : () => void undo(index)}
            />
          ))}
          {queued.map((text, index) => (
            <Asked key={index} text={text} />
          ))}
        </ConversationContent>
      </Conversation>
      <Composer
        draft={draft}
        working={working}
        limit={limit}
        onDraft={setDraft}
        onSend={send}
        onStop={() => stopper.current?.abort()}
      />
      {usageOpen && usage !== null ? <UsagePop id={popId} usage={usage} /> : null}
    </div>
  )
}
