import { cn } from "@/lib/class-names"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { PopoverContent } from "@/components/ui/popover"
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtLine,
  ChainOfThoughtStep,
  type StepStatus,
} from "@/components/ai-elements/chain-of-thought"
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message"
import { airaCopy, airaLimitBodyOn } from "@/copy/aira-copy"
import { productCopy, usageResetsOn } from "@/copy/product-copy"
import { usageCopy } from "@/copy/usage-copy"
import { LimitMark } from "@/credits/limit-panel"
import { surfaceShadow } from "@/editor/editor-chrome"
import { EditorIcon, SparkIcon } from "@/editor/editor-icons"
import type { AiraExchange, AiraStep, ToolState } from "@/aira/aira-loop"
import { replyPieces, type ReplyPiece } from "@/aira/aira-steps"
import { resetsWhen, usagePercent } from "@/aira/aira-usage"
import type { WeekUsage } from "@/aira/aira-wire"
import { settingsPaths } from "@/settings/settings-routes"

type Segment =
  | { readonly from: "user"; readonly text: string }
  | { readonly from: "assistant"; readonly steps: readonly AiraStep[] }

const cardClass =
  "flex flex-col gap-3 rounded-xl bg-white p-3.5 shadow-[0px_0px_0px_1px_var(--line),0px_1px_2px_var(--black-5)]"
const cardTitle = "text-[length:var(--type-dense)] leading-[17px] font-semibold text-foreground"
const cardBody = "text-[length:var(--type-dense)] leading-[1.5] text-quiet"

function segments(exchange: AiraExchange): readonly Segment[] {
  const found: Segment[] = [{ from: "user", text: exchange.asked }]
  for (const step of exchange.steps) {
    const last = found.at(-1)
    if (step.kind === "added") found.push({ from: "user", text: step.text })
    else if (last?.from === "assistant") found[found.length - 1] = { from: "assistant", steps: [...last.steps, step] }
    else found.push({ from: "assistant", steps: [step] })
  }
  return found
}

export function Asked({ text }: { text: string }) {
  return (
    <Message from="user">
      <MessageContent className="rounded-[var(--shape-dialog)] bg-line px-3.5 py-2.5 leading-[1.5] break-words whitespace-pre-wrap">
        {text}
      </MessageContent>
    </Message>
  )
}

const statusOf: Readonly<Record<ToolState, StepStatus | undefined>> = {
  working: "running",
  done: undefined,
  refused: "error",
  stopped: "stopped",
}

function StepsRow({ row }: { row: Extract<ReplyPiece, { kind: "steps" }> }) {
  if (row.reasons.length === 0) return <StepsLine row={row} />
  return (
    <div className="flex flex-col">
      <StepsLine row={row} />
      {row.reasons.map((reason) => (
        <p key={reason} data-step-reason className="pl-4.5 text-xs leading-[1.5] text-muted-foreground">
          {reason}
        </p>
      ))}
    </div>
  )
}

function StepsLine({ row }: { row: Extract<ReplyPiece, { kind: "steps" }> }) {
  if (row.lines.length === 1) {
    return (
      <ChainOfThoughtLine data-tool-state={row.state} status={statusOf[row.state]}>
        {row.title}
      </ChainOfThoughtLine>
    )
  }
  return (
    <ChainOfThought data-tool-state={row.state}>
      <ChainOfThoughtHeader status={statusOf[row.state]}>{row.title}</ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        {row.lines.map((line) => (
          <ChainOfThoughtStep key={line.id} data-tool-state={line.state} status={statusOf[line.state]}>
            {line.text}
          </ChainOfThoughtStep>
        ))}
      </ChainOfThoughtContent>
    </ChainOfThought>
  )
}

function PieceView({ piece }: { piece: ReplyPiece }) {
  if (piece.kind === "steps") return <StepsRow row={piece} />
  return <MessageResponse className="break-words whitespace-pre-wrap">{piece.text}</MessageResponse>
}

function Working() {
  return (
    <span className="flex h-6 items-center text-primary" data-aira-working aria-hidden="true">
      <SparkIcon size={14} className="motion-safe:animate-pulse" />
    </span>
  )
}

function UndoLink({ onUndo }: { onUndo: (() => void) | undefined }) {
  return (
    <button
      type="button"
      className="-ml-1.5 flex h-6 items-center gap-1.5 self-start rounded-[var(--shape-control)] px-1.5 text-xs text-muted-foreground outline-hidden [transition:color_var(--ease-micro)] hover:text-foreground disabled:opacity-50"
      disabled={onUndo === undefined}
      onClick={onUndo}
    >
      <EditorIcon name="undo" size={13} />
      {productCopy.undo}
    </button>
  )
}

function Undone() {
  return (
    <p className="flex min-h-6 items-center gap-1.5 text-xs text-muted-foreground" data-aira-undone>
      <EditorIcon name="undo" size={13} className="shrink-0" />
      {airaCopy.undone}
    </p>
  )
}

function UndoFailed() {
  return (
    <p className="flex min-h-6 items-center text-xs text-muted-foreground" data-undo-failed>
      {airaCopy.undoFailed}
    </p>
  )
}

function UndoRefused() {
  return (
    <p className="flex min-h-6 items-center text-xs text-muted-foreground" data-undo-refused>
      {airaCopy.undoRefused}
    </p>
  )
}

const cardButton = `h-8 rounded-lg bg-white px-3 text-[length:var(--type-dense)] font-medium text-foreground hover:bg-white active:translate-y-0 ${surfaceShadow}`

function FailedCard({
  title,
  body,
  onUndo,
  onRetry,
}: {
  title: string
  body: string
  onUndo: (() => void) | undefined
  onRetry: (() => void) | undefined
}) {
  return (
    <div className={cardClass} data-aira-failed>
      <span className="flex items-center gap-2">
        <FailedMark />
        <span className={cardTitle}>{title}</span>
      </span>
      <p className={cardBody}>{body}</p>
      {onUndo === undefined && onRetry === undefined ? null : (
        <span className="flex items-center gap-2">
          {onRetry === undefined ? null : (
            <Button type="button" variant="ghost" className={cardButton} onClick={onRetry}>
              {airaCopy.retry}
            </Button>
          )}
          {onUndo === undefined ? null : (
            <Button type="button" variant="ghost" className={cardButton} onClick={onUndo}>
              {productCopy.undo}
            </Button>
          )}
        </span>
      )}
    </div>
  )
}

function StuckCard({
  title,
  body,
  changed,
  onUndo,
  onNewChat,
}: {
  title: string
  body: string
  changed: boolean
  onNewChat?: (() => void) | undefined
  onUndo: (() => void) | undefined
}) {
  return (
    <div className={cardClass} data-aira-stuck>
      <span className="flex items-center gap-2">
        <FailedMark />
        <span className={cardTitle}>{title}</span>
      </span>
      <p className={cardBody}>{changed ? `${body} ${airaCopy.keptNote}` : body}</p>
      {onUndo === undefined && onNewChat === undefined ? null : (
        <span className="flex items-center gap-2">
          {onNewChat === undefined ? null : (
            <Button type="button" variant="ghost" className={cardButton} data-aira-new-chat onClick={onNewChat}>
              {airaCopy.newChat}
            </Button>
          )}
          {onUndo === undefined ? null : (
            <Button type="button" variant="ghost" className={cardButton} onClick={onUndo}>
              {productCopy.undo}
            </Button>
          )}
        </span>
      )}
    </div>
  )
}

function CountryCard() {
  return (
    <div className={cardClass} data-aira-country>
      <span className="flex items-center gap-2">
        <FailedMark />
        <span className={cardTitle}>{airaCopy.notOffered}</span>
      </span>
      <p className={cardBody}>{airaCopy.notOfferedBody}</p>
    </div>
  )
}

function LimitCard({ resets }: { resets: string | undefined }) {
  return (
    <div className={cardClass}>
      <span className="flex items-center gap-2">
        <LimitMark mark="tile" />
        <span className={cardTitle}>{productCopy.usageLimitTitle}</span>
      </span>
      {resets === undefined ? null : <p className={cardBody}>{airaLimitBodyOn(resetsWhen(resets))}</p>}
    </div>
  )
}

function cardOf(
  exchange: AiraExchange,
  resets: string | undefined,
  onUndo: (() => void) | undefined,
  onRetry: (() => void) | undefined,
  onNewChat: (() => void) | undefined,
): ReactNode | null {
  const undoable = exchange.runs.length > 0
  if (exchange.end === "out-of-usage") return <LimitCard resets={resets} />
  if (exchange.end === "country") return <CountryCard />
  if (exchange.end === "off") {
    return <StuckCard title={airaCopy.offTitle} body={airaCopy.offBody} changed={undoable} onUndo={onUndo} />
  }
  if (exchange.end === "malformed") {
    return (
      <StuckCard
        title={airaCopy.malformedTitle}
        body={airaCopy.malformedBody}
        changed={undoable}
        onUndo={onUndo}
        onNewChat={onNewChat}
      />
    )
  }
  if (exchange.end === "failed") {
    const body = undoable ? airaCopy.failedKept : airaCopy.failedNothing
    return <FailedCard title={airaCopy.failedTitle} body={body} onUndo={onUndo} onRetry={onRetry} />
  }
  if (exchange.end === "done" && refusedLast(exchange.steps)) {
    return (
      <FailedCard title={airaCopy.stepsFailedTitle} body={airaCopy.stepsFailedBody} onUndo={onUndo} onRetry={onRetry} />
    )
  }
  return null
}

function undoNoteOf(exchange: AiraExchange): ReactNode | null {
  if (exchange.undoRefused === true) return <UndoRefused />
  if (exchange.undoFailed === true) return <UndoFailed />
  return null
}

function endingOf(
  exchange: AiraExchange,
  resets: string | undefined,
  onUndo: (() => void) | undefined,
  onRetry: (() => void) | undefined,
  onNewChat: (() => void) | undefined,
): ReactNode | null {
  const undoable = exchange.runs.length > 0
  const undoOffer = undoable && exchange.undoRefused !== true ? onUndo : undefined
  const note = undoNoteOf(exchange)
  const card = cardOf(exchange, resets, undoOffer, onRetry, onNewChat)
  if (card !== null) {
    return note === null ? (
      card
    ) : (
      <>
        {card}
        {note}
      </>
    )
  }
  if (exchange.end === "undone") return <Undone />
  if ((exchange.end === "done" || exchange.end === "stopped") && undoable) {
    if (exchange.undoRefused === true) return note
    if (note === null) return <UndoLink onUndo={onUndo} />
    return (
      <div className="flex flex-col">
        {note}
        <UndoLink onUndo={onUndo} />
      </div>
    )
  }
  if (exchange.end === "working" && !running(exchange.steps)) return <Working />
  return null
}

export function refusedLast(steps: readonly AiraStep[]): boolean {
  const from = steps.findLastIndex((step) => step.kind === "retry")
  return steps.slice(from + 1).some((step) => step.kind === "tool" && step.state === "refused")
}

export function retryable(exchange: AiraExchange): boolean {
  return exchange.end === "failed" || (exchange.end === "done" && refusedLast(exchange.steps))
}

function running(steps: readonly AiraStep[]): boolean {
  const last = replyPieces(steps).at(-1)
  return last?.kind === "steps" && last.state === "working"
}

export function ExchangeView({
  exchange,
  resets,
  onUndo,
  onRetry,
  onNewChat,
}: {
  exchange: AiraExchange
  resets: string | undefined
  onUndo: (() => void) | undefined
  onNewChat?: (() => void) | undefined
  onRetry: (() => void) | undefined
}) {
  const parts = segments(exchange)
  const ending = endingOf(exchange, resets, onUndo, onRetry, onNewChat)
  const endsWithReply = parts.at(-1)?.from === "assistant"
  return (
    <>
      {parts.map((part, index) =>
        part.from === "user" ? (
          <Asked key={index} text={part.text} />
        ) : (
          <Message key={index} from="assistant">
            {replyPieces(part.steps).map((piece, at) => (
              <PieceView key={at} piece={piece} />
            ))}
            {index === parts.length - 1 ? ending : null}
          </Message>
        ),
      )}
      {endsWithReply || ending === null ? null : <Message from="assistant">{ending}</Message>}
    </>
  )
}

export function UsagePop({ usage }: { usage: WeekUsage }) {
  const percent = usagePercent(usage)
  return (
    <PopoverContent
      align="end"
      sideOffset={8}
      aria-label={productCopy.usageTitle}
      className="w-[220px] gap-2 rounded-[var(--shape-card)] bg-white p-3 text-foreground shadow-[0px_0px_0px_1px_var(--black-8),0px_8px_24px_var(--black-10)] ring-0"
    >
      <span className="flex items-center justify-between text-xs font-medium text-foreground">
        {productCopy.usageTitle}
        <span>{`${String(percent)}%`}</span>
      </span>
      <span className="flex h-1 rounded-full bg-line">
        <span
          data-usage-fill
          className={cn("block h-1 rounded-full", percent >= 100 ? "bg-destructive" : "bg-primary")}
          style={{ width: `${String(percent)}%` }}
        />
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="text-[length:var(--type-caption)] text-muted-foreground">
          {usageResetsOn(resetsWhen(usage.resets))}
        </span>
        <a
          href={settingsPaths.usage}
          aria-label={usageCopy.seeAllName}
          className="-mr-1 flex shrink-0 items-center gap-0.5 rounded-[var(--shape-control)] px-1 text-[length:var(--type-caption)] font-medium text-foreground outline-hidden"
        >
          {usageCopy.seeAll}
          <EditorIcon name="arrowr" size={11} />
        </a>
      </span>
    </PopoverContent>
  )
}

function FailedMark() {
  return (
    <span className="flex size-5 items-center justify-center rounded-[var(--shape-control)] bg-[linear-gradient(180deg,var(--danger-light),var(--destructive))] shadow-[inset_0px_1px_0px_var(--white-35),0px_0px_0px_1px_var(--danger-edge),0px_1px_2px_var(--black-12)]">
      <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
        <path d="M6 2.6v4.2" stroke="var(--background)" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="6" cy="9.2" r="1" fill="var(--background)" />
      </svg>
    </span>
  )
}
