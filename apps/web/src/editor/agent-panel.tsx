import { useEffect, type CSSProperties } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/ui/status-pill"
import { Toaster } from "@/components/ui/sonner"
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation"
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputChip,
  PromptInputFooter,
  PromptInputText,
} from "@/components/ai-elements/prompt-input"
import { Tool, ToolHeader } from "@/components/ai-elements/tool"
import { EditorIcon } from "@/editor/editor-icons"
import { ExportButton, surfaceShadow, ZoomReadout } from "@/editor/editor-chrome"
import type { SidebarRun } from "@/editor/slide-sidebar"
import { cn } from "@/lib/class-names"

const ask = "Make an 8-slide investor update from my notes. Calm, data first, our Halden brand."
const longAsk =
  "Make this chart tell the story faster. Lead with the Q3 number, then show the trend across all five quarters. Keep our Halden colors and label each bar with its value. Add one takeaway line under the title, revenue grew 39% year over year, and cut the source note down to a single line so the slide breathes."

export function AgentPanel({
  run,
  usageOpen = false,
  onExport,
}: {
  run: SidebarRun
  usageOpen?: boolean
  onExport?: () => void
}) {
  const offline = run === "offline"
  const working = run === "working"
  const fraction = working ? 0.34 : 0.38
  return (
    <aside className="relative flex h-full w-[360px] shrink-0 flex-col border-l border-line bg-white">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line pr-2 pl-3">
        <ZoomReadout value="64%" />
        <ExportButton faded={offline} {...(onExport === undefined ? {} : { onClick: onExport })} />
      </div>
      <div className="flex h-11 shrink-0 items-center justify-between pr-3 pl-3">
        <span className="flex h-6 items-center gap-1.5 rounded-[var(--shape-control)] pr-1.5 pl-1 text-xs text-quiet">
          <EditorIcon name="history" size={13} className="text-faint" />
          Q3 investor update
          <EditorIcon name="chev" size={11} className="text-faint" />
        </span>
        <span className="flex items-center gap-0.5">
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-[var(--shape-control)]",
              usageOpen && "bg-line",
            )}
          >
            <UsageRing fraction={fraction} />
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 rounded-md text-quiet active:translate-y-0"
            aria-label="New chat"
          >
            <EditorIcon name="pen" size={15} />
          </Button>
        </span>
      </div>
      <Conversation>
        <ConversationContent>
          <Message from="user">
            <MessageContent className="rounded-[var(--shape-dialog)] bg-line px-3.5 py-2.5 leading-[1.5]">
              {ask}
            </MessageContent>
            <span className="flex h-7 items-center gap-1.5 pl-2 text-xs text-[var(--muted-foreground)]">
              <FileGlyph />
              Q3 board notes.docx
            </span>
          </Message>
          <Message from="assistant">
            <AgentTurn run={run} />
          </Message>
        </ConversationContent>
      </Conversation>
      <Composer run={run} />
      {usageOpen ? <UsagePop /> : null}
    </aside>
  )
}

function AgentTurn({ run }: { run: SidebarRun }) {
  if (run === "working") {
    return (
      <>
        <Tool>
          <ToolHeader title="Read 1 file, applied Halden brand" />
        </Tool>
        <MessageResponse>Eight slides from your notes. Every chart uses your numbers.</MessageResponse>
        <Tool>
          <ToolHeader title="Built slides 1 and 2" />
        </Tool>
        <Tool>
          <ToolHeader title="Building slide 3 of 8" caret={false} />
        </Tool>
      </>
    )
  }
  if (run === "failed") {
    return (
      <>
        <Tool>
          <ToolHeader title="Read 1 file, built slides 1 to 3" />
        </Tool>
        <div className="flex flex-col gap-3 rounded-xl bg-white p-3.5 shadow-[0px_0px_0px_1px_var(--line),0px_1px_2px_var(--black-5)]">
          <span className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-[var(--shape-control)] bg-[linear-gradient(180deg,var(--danger-light),var(--destructive))] shadow-[inset_0px_1px_0px_var(--white-35),0px_0px_0px_1px_var(--danger-edge),0px_1px_2px_var(--black-12)]">
              <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
                <path d="M6 2.6v4.2" stroke="var(--background)" strokeWidth="1.9" strokeLinecap="round" />
                <circle cx="6" cy="9.2" r="1" fill="var(--background)" />
              </svg>
            </span>
            <span className="text-[length:var(--type-dense)] font-semibold text-foreground">
              Unable to finish this run
            </span>
          </span>
          <p className="text-[length:var(--type-dense)] leading-[1.5] text-quiet">Your work so far is saved.</p>
          <span className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-8 rounded-lg px-3 text-[length:var(--type-dense)] font-medium active:translate-y-0"
            >
              Resume
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "h-8 rounded-lg bg-white px-3 text-[length:var(--type-dense)] font-medium text-foreground hover:bg-white active:translate-y-0",
                surfaceShadow,
              )}
            >
              Undo
            </Button>
          </span>
        </div>
      </>
    )
  }
  return (
    <>
      <Tool>
        <ToolHeader title="Read 1 file, built 8 slides" />
      </Tool>
      <MessageResponse>Your deck is ready. Eight slides, every number from your notes.</MessageResponse>
      <span className="flex items-center gap-1.5 text-xs text-faint">
        <EditorIcon name="undo" size={13} />
        Undo
      </span>
    </>
  )
}

function Composer({ run }: { run: SidebarRun }) {
  if (run === "compose") {
    return (
      <div className="flex flex-col px-3 pb-3">
        <PromptInput className="flex-col gap-2.5 p-3">
          <span className="flex flex-wrap items-center gap-1.5">
            <PromptInputChip>
              Slide 3
              <EditorIcon name="x" size={11} className="text-faint" />
            </PromptInputChip>
            <PromptInputChip className="bg-blue-tint text-[var(--primary-strong)]">
              <EditorIcon name="chart" size={12} />
              Bar chart
              <EditorIcon name="x" size={11} />
            </PromptInputChip>
          </span>
          <div className="relative h-[145.61px] w-[311px] overflow-hidden">
            <PromptInputText className="relative text-foreground leading-[1.6] [inset-block-start:1px]">
              {longAsk}
            </PromptInputText>
            <span className="absolute inset-x-0 bottom-0 h-8 bg-[linear-gradient(180deg,var(--white-0)_0%,var(--background)_100%)]" />
          </div>
          <PromptInputFooter>
            <PromptInputButton className="size-7 rounded-md text-foreground" aria-label="Attach">
              <EditorIcon name="plus" size={17} />
            </PromptInputButton>
            <PromptInputButton
              className={cn(
                "size-8 rounded-full bg-white text-foreground hover:bg-white active:translate-y-0",
                surfaceShadow,
              )}
              aria-label="Send"
            >
              <EditorIcon name="up" size={16} />
            </PromptInputButton>
          </PromptInputFooter>
        </PromptInput>
      </div>
    )
  }
  const offline = run === "offline"
  const working = run === "working"
  return (
    <div className="flex flex-col px-3 pb-3">
      <PromptInput className={cn("h-12 items-center pr-2 pl-3", offline && "bg-canvas opacity-60")}>
        <PromptInputBody>
          <PromptInputButton className="size-7 rounded-md text-foreground" aria-label="Attach">
            <EditorIcon name="plus" size={17} />
          </PromptInputButton>
          {offline ? null : (
            <PromptInputChip>
              Slide 3
              <EditorIcon name="x" size={11} className="text-faint" />
            </PromptInputChip>
          )}
          <PromptInputText>
            {offline ? "Waits for connection" : working ? "Add to the request" : "Ask Aira"}
          </PromptInputText>
        </PromptInputBody>
        {working ? (
          <PromptInputButton className="size-7 rounded-full bg-ink" aria-label="Stop">
            <span className="block size-2.5 rounded-[2px] bg-white" />
          </PromptInputButton>
        ) : (
          <PromptInputButton className="size-7 rounded-md text-foreground" aria-label="Microphone">
            <EditorIcon name="mic" size={17} />
          </PromptInputButton>
        )}
      </PromptInput>
    </div>
  )
}

function FileGlyph() {
  return (
    <svg viewBox="0 0 13 13" width="13" height="13" aria-hidden="true" className="shrink-0">
      <path
        d="M7.58 1.63H3.79c-.6 0-1.08.48-1.08 1.08v7.58c0 .6.48 1.09 1.08 1.09h5.42c.6 0 1.08-.49 1.08-1.09V4.33L7.58 1.63z"
        fill="none"
        stroke="var(--muted-foreground)"
        strokeWidth="0.95"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.58 1.63V4.33h2.71"
        fill="none"
        stroke="var(--muted-foreground)"
        strokeWidth="0.95"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function UsageRing({ fraction }: { fraction: number }) {
  const dash = (2 * Math.PI * 7.5 * fraction).toFixed(1)
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" fill="none" stroke="var(--field-edge)" strokeWidth="2.5" />
      <circle
        cx="10"
        cy="10"
        r="7.5"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={`${dash} 100`}
        transform="rotate(-90 10 10)"
      />
    </svg>
  )
}

function UsagePop() {
  return (
    <div className="absolute top-[100px] right-3 flex w-[220px] flex-col gap-2 rounded-[var(--shape-card)] bg-white p-3 shadow-[0px_0px_0px_1px_var(--black-8),0px_8px_24px_var(--black-10)]">
      <span className="flex items-center justify-between text-xs font-medium text-foreground">
        Weekly usage
        <span>38%</span>
      </span>
      <span className="flex h-1 rounded-full bg-line">
        <span className="block h-1 w-[38%] rounded-full bg-primary" />
      </span>
      <span className="flex items-center justify-between">
        <span className="text-[length:var(--type-caption)] text-faint">Resets Mon 8:00 AM</span>
        <span className="flex items-center gap-0.5 text-[length:var(--type-caption)] font-medium text-foreground">
          See all
          <EditorIcon name="arrowr" size={11} />
        </span>
      </span>
    </div>
  )
}

const toastMetrics = {
  screen: { width: "301.11px", shift: "0px" },
  canvas: { width: "289.46px", shift: "-56px" },
} as const

export function EditorToast({
  kind,
  text,
  action,
  place = "screen",
}: {
  kind: "success" | "info"
  text: string
  action?: string
  place?: "screen" | "canvas"
}) {
  const { width, shift } = toastMetrics[place]
  useEffect(() => {
    toast.custom(
      () => (
        <StatusPill className="gap-2.5 pr-4 pl-3.5" style={{ width }}>
          {kind === "success" ? (
            <span className="relative block size-4 shrink-0">
              <svg
                className="absolute top-[5.19px] left-[3.63px] block"
                viewBox="3.13 4.69 8.75 5.94"
                width="8.75"
                height="5.94"
                aria-hidden="true"
              >
                <path
                  d="M3.13 7.81 5.94 10.63 11.88 4.69"
                  fill="none"
                  stroke="var(--background)"
                  strokeWidth="1.09"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          ) : null}
          <span className="min-w-0 flex-1 truncate">{text}</span>
          {action ? <span className="text-[length:var(--type-dense)] font-medium">{action}</span> : null}
        </StatusPill>
      ),
      {
        id: "editor-status",
        duration: Number.POSITIVE_INFINITY,
        unstyled: true,
        style: { left: 0, width, opacity: 1, transform: "translateY(0)", transition: "none" },
      },
    )
  }, [action, kind, text, width])
  return (
    <Toaster
      position="top-center"
      offset={{ top: 12 }}
      visibleToasts={1}
      style={{ "--width": width } as CSSProperties}
      className={shift === "0px" ? undefined : "![left:calc(50%-56px)]"}
    />
  )
}
