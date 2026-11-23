import { useEffect, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation"
import { useConversationFollow } from "@/components/ai-elements/conversation-follow"
import { airaBackOn, airaCopy } from "@/copy/aira-copy"
import { productCopy } from "@/copy/product-copy"
import { UsageRing } from "@/aira/usage-ring"
import { EditorIcon } from "@/components/ui/editor-icons"
import { cn } from "@/lib/class-names"
import {
  airaChat,
  askAira,
  retryAira,
  undoExchange,
  type AiraChat,
  type AskOptions,
  type UndoRun,
} from "@/aira/aira-loop"
import { AiraComposer } from "@/aira/aira-composer"
import { Asked, ExchangeView, UsagePop, retryable } from "@/aira/aira-reply"
import { resetsWhen, usagePercent } from "@/aira/aira-usage"
import { AiraWelcome } from "@/aira/aira-welcome"
import { chatTitle } from "@/aira/aira-history"
import { deviceChats, useChatHistory, type ChatStore } from "@/aira/aira-history-hook"
import { AiraHistoryMenu } from "@/aira/aira-history-menu"
import { signInAddress } from "@/account/sign-in-address"
import { useWeekUsage, type UsageLoad } from "@/usage-load"
import { requestedTone, tonePrompt, type Tone, type ToneScope } from "@/aira/aira-prompts"
import { adjustToneCopy } from "@/copy/adjust-tone-copy"
import type { ToneControlFor } from "@/editor/adjust-tone"
import type { ToneLink } from "@/editor/tone-link"

function usageBlock(loaded: UsageLoad | undefined) {
  if (loaded?.kind === "signed-out") return airaCopy.signIn
  if (loaded?.kind === "unavailable") return airaCopy.failedNothing
  if (loaded?.kind !== "usage") return undefined
  if (!loaded.available) return airaCopy.unavailable
  if (loaded.usage.used >= loaded.usage.allowed) return airaBackOn(resetsWhen(loaded.usage.resets))
  return undefined
}

export type AiraStart = {
  readonly chat?: AiraChat
  readonly draft?: string
  readonly usage?: () => Promise<UsageLoad>
}

const headControl = "outline-hidden active:translate-y-0"

export function AiraPanel({
  deck,
  hidden,
  design,
  toneLink,
  showAgent,
  opened,
  undo: undoRun,
  online = true,
  now = Date.now,
  mint = () => crypto.randomUUID(),
  store = deviceChats,
  start = {},
}: {
  deck: string
  hidden: boolean
  design?: (toneFor: ToneControlFor) => ReactNode
  toneLink?: ToneLink
  showAgent?: () => void
  opened?: () => Promise<unknown>
  undo: UndoRun
  online?: boolean
  now?: () => number
  mint?: () => string
  store?: ChatStore
  start?: AiraStart
}) {
  const [chat, setChat] = useState(() => start.chat ?? airaChat(deck))
  const [draft, setDraft] = useState(start.draft ?? "")
  const [queued, setQueued] = useState<readonly string[]>([])
  const [undoing, setUndoing] = useState(false)
  const [settling, setSettling] = useState(false)
  const [checkingTone, setCheckingTone] = useState(false)
  const checking = useRef<AbortController | null>(null)
  const latest = useRef(chat)
  const waiting = useRef<string[]>([])
  const stopper = useRef<AbortController | null>(null)
  const finishing = useRef<Promise<AiraChat | undefined>>(Promise.resolve(undefined))
  const field = useRef<HTMLTextAreaElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const inComposer = useRef(false)
  const returnToComposer = useRef(false)
  const last = chat.exchanges.at(-1)
  const working = last?.end === "working"
  const busy = working || settling || undoing || checkingTone
  const { usage, available, loaded, refresh: refreshUsage } = useWeekUsage(chat.usage, online, start.usage)
  const limit = last?.end === "out-of-usage" && usage !== null ? airaBackOn(resetsWhen(usage.resets)) : undefined
  const notOffered = !available || last?.end === "country"
  const blocked = notOffered ? airaCopy.unavailable : last?.end === "malformed" ? airaCopy.malformedBlocked : limit
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
  const title = history.current?.title ?? (asked === undefined ? airaCopy.chatsTitle : chatTitle(asked))

  const malformed = last?.end === "malformed"

  useEffect(
    () => () => {
      checking.current?.abort()
      stopper.current?.abort()
    },
    [],
  )

  useEffect(() => {
    function moved(event: FocusEvent) {
      if (event.target !== field.current) inComposer.current = false
    }
    document.addEventListener("focusin", moved)
    return () => document.removeEventListener("focusin", moved)
  }, [])

  useEffect(() => {
    if (!malformed || busy || !inComposer.current) return
    const button = panel.current?.querySelector<HTMLElement>("[data-aira-stuck] [data-aira-new-chat]")
    if (button === undefined || button === null) return
    button.focus()
    inComposer.current = false
  }, [malformed, busy])

  useEffect(() => {
    if (!returnToComposer.current || blocked !== undefined) return
    returnToComposer.current = false
    field.current?.focus()
  }, [chat, blocked])

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

  async function run(start: (chat: AiraChat, options: AskOptions) => Promise<AiraChat>) {
    const controller = new AbortController()
    stopper.current = controller
    setSettling(true)
    const asking = start(latest.current, {
      signal: controller.signal,
      show: (next) => {
        if (stopper.current === controller) shown(next)
      },
      added: takeQueued,
      after: finishing.current,
      ...(opened === undefined ? {} : { opened: opened() }),
    })
    finishing.current = asking
    const done = await asking
    if (done.exchanges.at(-1)?.end === "stopped") refreshUsage()
    if (stopper.current !== controller) return
    stopper.current = null
    setSettling(false)
    shown(done)
    const end = done.exchanges.at(-1)?.end
    if (end === "signed-out") {
      window.location.assign(signInAddress(window.location))
      return
    }
    const left = takeQueued()
    if (left === undefined) return
    if (end === "done") void run((chat, options) => askAira(chat, left, options))
    else setDraft((now) => (now === "" ? left : `${left}\n${now}`))
  }

  function ask(said: string) {
    const text = said.trim()
    if (text === "" || blocked !== undefined || undoing || checking.current !== null) return false
    toLatest()
    if (!working) {
      void run((chat, options) => askAira(chat, text, options))
      return true
    }
    waiting.current.push(text)
    setQueued([...waiting.current])
    return true
  }

  function retry() {
    if (busy || blocked !== undefined) return
    toLatest()
    void run(retryAira)
  }

  function send() {
    if (ask(draft)) setDraft("")
  }

  async function undo(exchange: number, focus = true) {
    setUndoing(true)
    const next = await undoExchange(latest.current, exchange, undoRun)
    setUndoing(false)
    if (next === undefined) return false
    returnToComposer.current = focus && document.activeElement === document.body
    shown(next)
    return next.exchanges[exchange]?.end === "undone"
  }

  const toneBlocked =
    (!online ? productCopy.editorOffline : undefined) ??
    (last?.end === "off" ? airaCopy.offTitle : undefined) ??
    blocked ??
    usageBlock(loaded) ??
    (usage !== null && usage.used >= usage.allowed ? airaBackOn(resetsWhen(usage.resets)) : undefined)

  function toneFor(scope: ToneScope) {
    const exchange = chat.exchanges.findLastIndex(({ asked }) => requestedTone(scope, asked) !== undefined)
    const previous = chat.exchanges[exchange]
    const active = previous !== undefined && previous.end !== "undone"
    const choice = active ? requestedTone(scope, previous.asked) : undefined
    const resettable = active && previous.runs.length > 0 && !previous.undoRefused

    const connected = () => navigator.onLine !== false
    async function adjust(tone: Tone | undefined) {
      if (!connected() || toneBlocked !== undefined || busy || checking.current !== null) return
      if (previous?.undoRefused === true || (tone === undefined && !resettable)) return
      const controller = new AbortController()
      checking.current = controller
      setCheckingTone(true)
      try {
        const current = await refreshUsage()
        if (controller.signal.aborted || !connected() || usageBlock(current) !== undefined) return
        if (resettable && !(await undo(exchange, false))) return
        if (tone !== undefined && !controller.signal.aborted && connected()) {
          returnToComposer.current = true
          showAgent?.()
          toLatest()
          void run((chat, options) => askAira(chat, tonePrompt(scope, tone), options))
        }
      } finally {
        checking.current = null
        if (!controller.signal.aborted) setCheckingTone(false)
      }
    }

    return {
      blocked: toneBlocked ?? (scope.text.length === 0 ? adjustToneCopy.nothing : undefined),
      notice: previous?.undoRefused ? airaCopy.undoRefused : previous?.undoFailed ? airaCopy.undoFailed : undefined,
      busy: busy || loaded === undefined || previous?.undoRefused === true,
      choice,
      resettable,
      refresh: () => {
        if (online) void refreshUsage()
      },
      choose: (tone: Tone) => void adjust(tone),
      reset: () => void adjust(undefined),
    }
  }

  useEffect(() => {
    toneLink?.publish(toneFor)
  })

  useEffect(() => () => toneLink?.publish(null), [toneLink])

  function newChat() {
    waiting.current = []
    setQueued([])
    history.start()
    display({ ...airaChat(deck), usage: latest.current.usage })
  }

  function newChatFromCard() {
    returnToComposer.current = true
    newChat()
  }

  function pick(id: string) {
    if (busy) return
    const picked = history.pick(id)
    if (picked === undefined) return
    waiting.current = []
    setQueued([])
    setDraft("")
    shown({ ...picked, usage: latest.current.usage })
  }

  const agent = (
    <div ref={panel} className="relative flex min-h-0 flex-1 flex-col" hidden={hidden} data-aira-panel>
      <div data-slot="conversation-head" className="flex h-11 shrink-0 items-center justify-between gap-2 pr-3 pl-3">
        <span className="flex min-w-0 flex-1">
          <AiraHistoryMenu
            title={title}
            asked={asked}
            chats={history.chats}
            openId={history.openId}
            now={now()}
            disabled={busy}
            onPick={pick}
          />
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          {usage === null ? null : (
            <Popover
              onOpenChange={(open) => {
                if (open) refreshUsage()
              }}
            >
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={productCopy.usageTitle}
                    className={cn("size-6 rounded-[var(--shape-control)] data-popup-open:bg-line", headControl)}
                  />
                }
              >
                <UsageRing fraction={usagePercent(usage) / 100} />
              </PopoverTrigger>
              <UsagePop usage={usage} />
            </Popover>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("size-7 rounded-md text-quiet", headControl)}
            aria-label={airaCopy.newChat}
            disabled={empty || busy}
            onClick={newChat}
          >
            <EditorIcon name="pen" size={15} />
          </Button>
        </span>
      </div>
      {empty ? (
        <AiraWelcome notOffered={notOffered} />
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <Conversation
            ref={viewport}
            onScroll={onScroll}
            tabIndex={0}
            aria-label={productCopy.agentName}
            aria-relevant="additions"
            aria-busy={working}
            className="overflow-y-auto outline-hidden"
          >
            <ConversationContent ref={content} className="pb-4">
              {chat.exchanges.map((exchange, index) => (
                <ExchangeView
                  key={index}
                  exchange={exchange}
                  resets={usage?.resets}
                  onNewChat={busy ? undefined : newChatFromCard}
                  onUndo={busy ? undefined : () => void undo(index)}
                  onRetry={
                    index === chat.exchanges.length - 1 &&
                    retryable(exchange) &&
                    !working &&
                    !undoing &&
                    blocked === undefined
                      ? retry
                      : undefined
                  }
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
        blocked={blocked}
        field={field}
        onFocusChange={(focused) => {
          inComposer.current = focused
        }}
        onDraft={setDraft}
        onSend={send}
        onStop={() => stopper.current?.abort()}
      />
    </div>
  )
  return (
    <>
      {design?.(toneFor)}
      {agent}
    </>
  )
}
