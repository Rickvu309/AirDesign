import { cn } from "@/lib/class-names"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
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
import { FailedMark } from "@/editor/agent-panel"
import { surfaceShadow } from "@/editor/editor-chrome"
import { EditorIcon, SparkIcon } from "@/editor/editor-icons"
import type { AiraExchange, AiraStep, ToolState } from "@/aira-loop"
import { replyPieces, type ReplyPiece } from "@/aira-steps"
import { resetsWhen, usagePercent } from "@/aira-usage"
import type { WeekUsage } from "@/aira-wire"
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
      className="-ml-1.5 flex h-6 items-center gap-1.5 self-start rounded-[var(--shape-control)] px-1.5 text-xs text-muted-foreground outline-hidden [transition:color_var(--ease-micro)] hover:text-foreground focus-visible:shadow-[0px_0px_0px_2px_var(--ring)] disabled:opacity-50 motion-reduce:transition-none"
      disabled={onUndo === undefined}
      onClick={onUndo}
    >
      <EditorIcon name="undo" size={13} />
      {productCopy.undo}
    </button>
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
  changed,
  onUndo,
  onRetry,
}: {
  changed: boolean
  onUndo: (() => void) | undefined
  onRetry: (() => void) | undefined
}) {
  return (
    <div className={cardClass} data-aira-failed>
      <span className="flex items-center gap-2">
        <FailedMark />
        <span className={cardTitle}>{airaCopy.failedTitle}</span>
      </span>
      <p className={cardBody}>{changed ? airaCopy.failedKept : airaCopy.failedNothing}</p>
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

function endingOf(
  exchange: AiraExchange,
  resets: string | undefined,
  onUndo: (() => void) | undefined,
  onRetry: (() => void) | undefined,
): ReactNode | null {
  const undoable = exchange.runs.length > 0
  const refused = exchange.undoRefused === true
  if (exchange.end === "out-of-usage") return <LimitCard resets={resets} />
  if (exchange.end === "country") return <CountryCard />
  if (exchange.end === "failed") {
    return <FailedCard changed={undoable} onUndo={undoable && !refused ? onUndo : undefined} onRetry={onRetry} />
  }
  if ((exchange.end === "done" || exchange.end === "stopped") && undoable) {
    return refused ? <UndoRefused /> : <UndoLink onUndo={onUndo} />
  }
  if (exchange.end === "working" && !running(exchange.steps)) return <Working />
  return null
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
}: {
  exchange: AiraExchange
  resets: string | undefined
  onUndo: (() => void) | undefined
  onRetry: (() => void) | undefined
}) {
  const parts = segments(exchange)
  const ending = endingOf(exchange, resets, onUndo, onRetry)
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

export function UsagePop({ id, usage }: { id: string; usage: WeekUsage }) {
  const percent = usagePercent(usage)
  return (
    <div
      id={id}
      role="region"
      aria-label={productCopy.usageTitle}
      className="absolute top-11 right-3 z-10 flex w-[220px] flex-col gap-2 rounded-[var(--shape-card)] bg-white p-3 shadow-[0px_0px_0px_1px_var(--black-8),0px_8px_24px_var(--black-10)]"
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
          className="-mr-1 flex shrink-0 items-center gap-0.5 rounded-[var(--shape-control)] px-1 text-[length:var(--type-caption)] font-medium text-foreground outline-hidden focus-visible:shadow-[0px_0px_0px_2px_var(--ring)]"
        >
          {usageCopy.seeAll}
          <EditorIcon name="arrowr" size={11} />
        </a>
      </span>
    </div>
  )
}
