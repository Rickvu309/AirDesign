import { useEffect, useId, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation"
import { useConversationFollow } from "@/components/ai-elements/conversation-follow"
import { airaBackOn, airaCopy } from "@/copy/aira-copy"
import { productCopy } from "@/copy/product-copy"
import { creditsCopy } from "@/credits/credits-sample"
import { UsageRing } from "@/editor/agent-panel"
import { EditorIcon } from "@/editor/editor-icons"
import { cn } from "@/lib/class-names"
import { airaChat, askAira, undoExchange, type AiraChat } from "@/aira-loop"
import { AiraComposer } from "@/aira-composer"
import { Asked, ExchangeView, UsagePop } from "@/aira-reply"
import { resetsWhen, usagePercent } from "@/aira-usage"
import { AiraWelcome } from "@/aira-welcome"
import { chatTitle } from "@/aira-history"
import { deviceChats, useChatHistory, type ChatStore } from "@/aira-history-hook"
import { AiraHistoryMenu } from "@/aira-history-menu"
import { signInAddress } from "@/thin-notice"
import { useWeekUsage } from "@/usage-load"

const headControl = "outline-hidden focus-visible:shadow-[0px_0px_0px_2px_var(--ring)] active:translate-y-0"

export function AiraPanel({
  deck,
  hidden,
  now = Date.now,
  mint = () => crypto.randomUUID(),
  store = deviceChats,
}: {
  deck: string
  hidden: boolean
  now?: () => number
  mint?: () => string
  store?: ChatStore
}) {
  const [chat, setChat] = useState(() => airaChat(deck))
  const [draft, setDraft] = useState("")
  const [queued, setQueued] = useState<readonly string[]>([])
  const [usageOpen, setUsageOpen] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const latest = useRef(chat)
  const waiting = useRef<string[]>([])
  const stopper = useRef<AbortController | null>(null)
  const finishing = useRef<Promise<unknown>>(Promise.resolve())
  const popId = useId()
  const last = chat.exchanges.at(-1)
  const working = last?.end === "working"
  const { usage, refresh: refreshUsage } = useWeekUsage(chat.usage)
  const limit = last?.end === "out-of-usage" && usage !== null ? airaBackOn(resetsWhen(usage.resets)) : undefined
  const empty = chat.exchanges.length === 0
  const asked = chat.exchanges[0]?.asked
  const { viewport, content, away, toLatest, onScroll } = useConversationFollow(empty)
  const history = useChatHistory({
    deck,
    now,
    mint,
    store,
    onRestore: display,
    empty: () => latest.current.exchanges.length === 0,
  })
  const title = history.current?.title ?? (asked === undefined ? creditsCopy.newChat : chatTitle(asked))

  useEffect(() => () => stopper.current?.abort(), [])

  function display(next: AiraChat) {
    latest.current = next
    setChat(next)
  }

  function shown(next: AiraChat) {
    display(next)
    history.remember(next)
  }

  function takeQueued(): string | undefined {
    const text = waiting.current.splice(0).join("\n")
    setQueued([])
    return text === "" ? undefined : text
  }

  async function run(text: string) {
    const controller = new AbortController()
    stopper.current = controller
    const asking = askAira(latest.current, text, {
      signal: controller.signal,
      show: shown,
      added: takeQueued,
      after: finishing.current,
    })
    finishing.current = asking
    const done = await asking
    if (done.exchanges.at(-1)?.end === "stopped") refreshUsage()
    if (stopper.current !== controller) return
    stopper.current = null
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

  function ask(said: string) {
    const text = said.trim()
    if (text === "" || limit !== undefined || undoing) return false
    toLatest()
    if (!working) {
      void run(text)
      return true
    }
    waiting.current.push(text)
    setQueued([...waiting.current])
    return true
  }

  function send() {
    if (ask(draft)) setDraft("")
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
    history.start()
    display({ ...airaChat(deck), usage: latest.current.usage })
  }

  function pick(id: string) {
    if (working || undoing) return
    const picked = history.pick(id)
    if (picked === undefined) return
    waiting.current = []
    setQueued([])
    setDraft("")
    display({ ...picked, usage: latest.current.usage })
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" hidden={hidden} data-aira-panel>
      <div data-slot="conversation-head" className="flex h-11 shrink-0 items-center justify-between gap-2 pr-3 pl-3">
        <span className="flex min-w-0 flex-1">
          <AiraHistoryMenu
            title={title}
            asked={asked}
            chats={history.chats}
            openId={history.openId}
            now={now()}
            disabled={working || undoing}
            onPick={pick}
          />
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          {usage === null ? null : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={productCopy.usageTitle}
              aria-expanded={usageOpen}
              aria-controls={popId}
              className={cn("size-6 rounded-[var(--shape-control)]", headControl, usageOpen && "bg-line")}
              onClick={() => {
                if (!usageOpen) refreshUsage()
                setUsageOpen(!usageOpen)
              }}
            >
              <UsageRing fraction={usagePercent(usage) / 100} />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("size-7 rounded-md text-quiet", headControl)}
            aria-label={creditsCopy.newChat}
            disabled={empty || working || undoing}
            onClick={newChat}
          >
            <EditorIcon name="pen" size={15} />
          </Button>
        </span>
      </div>
      {empty ? (
        <AiraWelcome onPick={(text) => void ask(text)} disabled={limit !== undefined || undoing} />
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <Conversation
            ref={viewport}
            onScroll={onScroll}
            tabIndex={0}
            aria-label={productCopy.agentName}
            aria-relevant="additions"
            aria-busy={working}
            className="overflow-y-auto outline-hidden focus-visible:shadow-[inset_0px_0px_0px_2px_var(--ring)]"
          >
            <ConversationContent ref={content} className="pb-4">
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
          <ConversationScrollButton label={airaCopy.latest} shown={away} onClick={toLatest} />
        </div>
      )}
      <AiraComposer
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
