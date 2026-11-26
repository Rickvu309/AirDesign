import { accountRoutes } from "@airdesign/catalog"
import { CheckIcon, CopyIcon, XIcon } from "lucide-react"
import { Fragment, useEffect, useRef, useState } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  addStepOf,
  connectAgentCopy,
  connectChoices,
  connectedOf,
  promptStepOf,
  setupPromptOf,
  signInStepOf,
  waitingOf,
  type ConnectWay,
} from "@/copy/connect-agent-copy"
import { productCopy } from "@/copy/product-copy"
import { AgentMark } from "@/decks/agent-mark"
import { agentLabel, agentMark, type AgentListing, type ConnectedAgent } from "@/decks/connected-agent"
import { post } from "@/decks/deck-request"
import { cn } from "@/lib/class-names"

const pollEvery = 2000
const dense = "text-[length:var(--type-dense)] leading-[var(--leading-body)]"
const quietEdge = "border-0 bg-background shadow-[inset_0_0_0_1px_var(--field-edge)] hover:bg-background"
const quietAction = `h-[var(--space-32)] shrink-0 px-3.5 text-[length:var(--type-dense)] leading-[17px] ${quietEdge}`
const quietIcon = `text-muted-foreground hover:text-foreground ${quietEdge}`
const swap =
  "col-start-1 row-start-1 transition-[opacity,scale,filter] duration-(--duration-micro) ease-out motion-reduce:transition-none"
const iconShown = "scale-100 opacity-100 blur-none"
const iconHidden = "scale-50 opacity-0 blur-[2px]"
const picked = "bg-background text-foreground shadow-[0_0_0_1px_var(--line),0_1px_2px_rgb(0_0_0/6%)]"

function Copied({ text, label, prompt = false }: { text: string; label: string; prompt?: boolean }) {
  const [status, setStatus] = useState<"ready" | "copied" | "failed">("ready")
  const shown = useRef<HTMLSpanElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )

  async function copy() {
    if (timer.current !== null) clearTimeout(timer.current)
    try {
      await navigator.clipboard.writeText(text)
      setStatus("copied")
      timer.current = setTimeout(() => setStatus("ready"), 2000)
    } catch {
      setStatus("failed")
      if (shown.current === null) return
      const range = document.createRange()
      range.selectNodeContents(shown.current)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }

  const name = status === "copied" ? productCopy.done : status === "failed" ? connectAgentCopy.copyFailed : label

  return (
    <>
      <div
        className={cn(
          "mt-2 flex gap-2 rounded-lg bg-muted",
          prompt ? "flex-col p-3" : "min-h-10 items-center py-1 pr-1 pl-3",
        )}
      >
        <span
          ref={shown}
          className={cn(
            "min-w-0 flex-1 text-foreground",
            dense,
            prompt ? "[overflow-wrap:anywhere]" : "font-mono [overflow-wrap:break-word]",
          )}
        >
          {prompt
            ? text
            : text.split(/(?<=\/)(?!\/)/).map((part, index) => (
                <Fragment key={index}>
                  {index > 0 ? <wbr /> : null}
                  {part}
                </Fragment>
              ))}
        </span>
        {prompt ? (
          <Button
            type="button"
            variant="signature"
            disabled={text === ""}
            className="self-end"
            onClick={() => void copy()}
          >
            {name}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={text === ""}
            aria-label={name}
            title={name}
            className={quietIcon}
            onClick={() => void copy()}
          >
            <span className="grid">
              <CopyIcon aria-hidden className={cn(swap, status === "copied" ? iconHidden : iconShown)} />
              <CheckIcon aria-hidden className={cn(swap, status === "copied" ? iconShown : iconHidden)} />
            </span>
          </Button>
        )}
      </div>
      <p role="status" className={cn(dense, "text-muted-foreground", status === "failed" && "mt-2")}>
        {status === "failed" ? connectAgentCopy.copyManually : ""}
      </p>
    </>
  )
}

function Step({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[length:var(--type-caption)] font-semibold text-quiet">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn(dense, "font-medium text-foreground")}>{title}</p>
        {children}
      </div>
    </li>
  )
}

function Steps({ way, address }: { way: ConnectWay; address: string }) {
  const hint = cn(dense, "mt-0.5 text-muted-foreground")
  if (way.kind === "prompt") {
    return (
      <ol className="mt-5 flex flex-col gap-5">
        <Step index={1} title={promptStepOf(way.name)}>
          <Copied
            key={way.id}
            text={address === "" ? "" : setupPromptOf(address)}
            label={connectAgentCopy.copyPrompt}
            prompt
          />
        </Step>
        <Step index={2} title={connectAgentCopy.allowStep}>
          <p className={hint}>{signInStepOf(way.name)}</p>
        </Step>
      </ol>
    )
  }
  return (
    <ol className="mt-5 flex flex-col gap-5">
      <Step index={1} title={connectAgentCopy.addressStep}>
        <Copied key={way.id} text={address} label={connectAgentCopy.copy} />
      </Step>
      <Step index={2} title={addStepOf(way.name)}>
        <p className={hint}>{way.add}</p>
        {way.open ? (
          <a
            href={way.open.href}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "signature" }), "mt-2.5 px-3.5")}
          >
            {way.open.label}
          </a>
        ) : null}
      </Step>
    </ol>
  )
}

export function ConnectAgent({
  onClose,
  onConnected,
}: {
  onClose: () => void
  onConnected?: (listing: AgentListing) => void
}) {
  const [listing, setListing] = useState<AgentListing | null>(null)
  const [failed, setFailed] = useState(false)
  const [connected, setConnected] = useState<ConnectedAgent | null>(null)
  const [choiceId, setChoiceId] = useState<string>(connectChoices[0].id)
  const [wayIds, setWayIds] = useState<Record<string, string>>({})
  const known = useRef<Set<string> | null>(null)
  const asking = useRef(false)

  async function load() {
    if (asking.current) return
    asking.current = true
    try {
      const result = await post(accountRoutes.agents.path, {})
      if (!result.ok) return setFailed(true)
      const agents: ConnectedAgent[] = result.agents
      const fresh = known.current === null ? undefined : agents.find((item) => !known.current?.has(item.id))
      known.current = new Set(agents.map((item) => item.id))
      setListing(result)
      setFailed(false)
      if (fresh) {
        setConnected(fresh)
        onConnected?.(result)
      }
    } catch {
      setFailed(true)
    } finally {
      asking.current = false
    }
  }

  const waiting = connected === null
  useEffect(() => {
    if (!waiting) return
    void Promise.resolve().then(load)
    const timer = setInterval(() => void load(), pollEvery)
    return () => clearInterval(timer)
  }, [waiting])

  const choice = connectChoices.find((item) => item.id === choiceId) ?? connectChoices[0]
  const way = choice.ways.find((item) => item.id === wayIds[choice.id]) ?? choice.ways[0]
  const title = "text-lg leading-6 font-semibold tracking-[-0.3px] text-foreground"

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPortal>
        <DialogOverlay className="bg-black/25" />
        <DialogPopup
          data-connect-agent
          className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-1rem)] w-[480px] max-w-[calc(100%-1rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--shape-dialog)] bg-background p-7 shadow-[inset_0_0_0_1px_rgb(0_0_0/8%),0_24px_48px_rgb(0_0_0/16%)] outline-none max-md:p-5"
        >
          {connected ? (
            <>
              <div className="flex items-center justify-center gap-2.5">
                <AgentMark name="airdesign" size={44} />
                <span className="flex size-5 items-center justify-center rounded-full bg-positive/15 text-positive-text">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path
                      d="M2.9 7.3 5.5 9.9 11.1 4.4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <AgentMark name={agentMark(connected)} size={44} />
              </div>
              <DialogTitle className={cn(title, "mt-4 text-center")}>{connectedOf(agentLabel(connected))}</DialogTitle>
              <DialogDescription className={cn(dense, "mt-1 text-center text-muted-foreground")}>
                {connectAgentCopy.connectedBody}
              </DialogDescription>
              <Button type="button" variant="signature" className="mt-6 h-9 w-full" onClick={onClose}>
                {productCopy.done}
              </Button>
            </>
          ) : (
            <>
              <div className="relative">
                <DialogTitle className={title}>{connectAgentCopy.title}</DialogTitle>
                <DialogClose
                  aria-label={productCopy.close}
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="absolute -top-0.5 -right-1.5 text-muted-foreground"
                    />
                  }
                >
                  <XIcon />
                </DialogClose>
              </div>
              <DialogDescription className={cn(dense, "mt-1 text-muted-foreground")}>
                {connectAgentCopy.body}
              </DialogDescription>
              <div role="group" aria-label={connectAgentCopy.agents} className="mt-5 grid grid-cols-4 gap-2">
                {connectChoices.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={item.id === choice.id}
                    onClick={() => setChoiceId(item.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl pt-3 pb-2.5 font-medium",
                      dense,
                      item.id === choice.id
                        ? "bg-pressed text-foreground shadow-[inset_0_0_0_1.5px_var(--pressed-edge)]"
                        : "text-quiet shadow-[inset_0_0_0_1px_var(--line)] hover:bg-muted",
                    )}
                  >
                    <AgentMark name={item.mark} size={32} />
                    {item.name}
                  </button>
                ))}
              </div>
              {choice.ways.length > 1 ? (
                <div role="group" aria-label={connectAgentCopy.ways} className="mt-3 flex rounded-lg bg-muted p-0.5">
                  {choice.ways.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={item.id === way.id}
                      onClick={() => setWayIds((ids) => ({ ...ids, [choice.id]: item.id }))}
                      className={cn(
                        "h-7 flex-1 rounded-md font-medium",
                        dense,
                        item.id === way.id ? picked : "text-quiet hover:text-foreground",
                      )}
                    >
                      {item.tab}
                    </button>
                  ))}
                </div>
              ) : null}
              {listing === null && failed ? (
                <div role="alert" className="mt-5 flex items-center justify-between gap-4 rounded-lg bg-muted p-3.5">
                  <span className={cn(dense, "text-muted-foreground")}>{connectAgentCopy.loadFailed}</span>
                  <Button type="button" variant="outline" className={quietAction} onClick={() => void load()}>
                    {productCopy.payTryAgain}
                  </Button>
                </div>
              ) : (
                <>
                  <Steps way={way} address={listing?.mcp ?? ""} />
                  <p
                    className={cn(
                      dense,
                      "mt-6 flex items-center gap-2 border-t border-line pt-4 text-muted-foreground",
                    )}
                  >
                    <span className="size-2 shrink-0 rounded-full bg-primary motion-safe:animate-pulse" />
                    {waitingOf(way.name)}
                  </p>
                </>
              )}
            </>
          )}
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
