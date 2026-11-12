import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message"
import { Tool, ToolHeader } from "@/components/ai-elements/tool"
import { productCopy, usageLimitBodyOn, usageResetsOn } from "@/copy/product-copy"
import { LimitMark } from "@/credits/limit-panel"
import { FailedMark } from "@/editor/agent-panel"
import { surfaceShadow } from "@/editor/editor-chrome"
import { EditorIcon } from "@/editor/editor-icons"
import type { AiraExchange, AiraStep } from "@/aira-loop"
import { resetsWhen, usagePercent } from "@/aira-usage"
import type { WeekUsage } from "@/aira-wire"

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

function StepView({ step }: { step: AiraStep }) {
  if (step.kind === "tool") {
    return (
      <Tool data-tool-state={step.state}>
        <ToolHeader title={step.name} caret={step.state !== "working"} />
      </Tool>
    )
  }
  return <MessageResponse className="break-words whitespace-pre-wrap">{step.text}</MessageResponse>
}

function UndoLink({ onUndo }: { onUndo: (() => void) | undefined }) {
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 self-start text-xs text-faint hover:text-quiet disabled:opacity-50"
      disabled={onUndo === undefined}
      onClick={onUndo}
    >
      <EditorIcon name="undo" size={13} />
      {productCopy.undo}
    </button>
  )
}

function FailedCard({ onUndo }: { onUndo: (() => void) | undefined }) {
  return (
    <div className={cardClass}>
      <span className="flex items-center gap-2">
        <FailedMark />
        <span className={cardTitle}>{productCopy.agentFailedTitle}</span>
      </span>
      <p className={cardBody}>{productCopy.agentFailedBody}</p>
      {onUndo === undefined ? null : (
        <span className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className={`h-8 rounded-lg bg-white px-3 text-[length:var(--type-dense)] font-medium text-foreground hover:bg-white active:translate-y-0 ${surfaceShadow}`}
            onClick={onUndo}
          >
            {productCopy.undo}
          </Button>
        </span>
      )}
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
      {resets === undefined ? null : <p className={cardBody}>{usageLimitBodyOn(resetsWhen(resets))}</p>}
    </div>
  )
}

function endingOf(
  exchange: AiraExchange,
  resets: string | undefined,
  onUndo: (() => void) | undefined,
): ReactNode | null {
  const undoable = exchange.runs.length > 0
  if (exchange.end === "out-of-usage") return <LimitCard resets={resets} />
  if (exchange.end === "failed") return <FailedCard onUndo={undoable ? onUndo : undefined} />
  if ((exchange.end === "done" || exchange.end === "stopped") && undoable) return <UndoLink onUndo={onUndo} />
  return null
}

export function ExchangeView({
  exchange,
  resets,
  onUndo,
}: {
  exchange: AiraExchange
  resets: string | undefined
  onUndo: (() => void) | undefined
}) {
  const parts = segments(exchange)
  const ending = endingOf(exchange, resets, onUndo)
  const endsWithReply = parts.at(-1)?.from === "assistant"
  return (
    <>
      {parts.map((part, index) =>
        part.from === "user" ? (
          <Asked key={index} text={part.text} />
        ) : (
          <Message key={index} from="assistant">
            {part.steps.map((step, at) => (
              <StepView key={at} step={step} />
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
      className="absolute top-[100px] right-3 z-10 flex w-[220px] flex-col gap-2 rounded-[var(--shape-card)] bg-white p-3 shadow-[0px_0px_0px_1px_var(--black-8),0px_8px_24px_var(--black-10)]"
    >
      <span className="flex items-center justify-between text-xs font-medium text-foreground">
        {productCopy.usageTitle}
        <span>{`${String(percent)}%`}</span>
      </span>
      <span className="flex h-1 rounded-full bg-line">
        <span className="block h-1 rounded-full bg-primary" style={{ width: `${String(percent)}%` }} />
      </span>
      <span className="text-[length:var(--type-caption)] text-faint">{usageResetsOn(resetsWhen(usage.resets))}</span>
    </div>
  )
}
