import { Button } from "@/components/ui/button"
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation"
import { Message, MessageContent } from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputChip,
  PromptInputText,
} from "@/components/ai-elements/prompt-input"
import { Tool, ToolHeader } from "@/components/ai-elements/tool"
import { productCopy } from "@/copy/product-copy"
import { creditsCopy } from "@/credits/credits-sample"
import { EditorIcon } from "@/editor/editor-icons"
import { ExportButton, ZoomReadout } from "@/editor/editor-chrome"

export function LimitCover({ phase, mark = "tile" }: { phase: "limit" | "reset"; mark?: "tile" | "ring" }) {
  return (
    <div className="absolute inset-y-0 right-0 z-20 w-[360px]">
      <LimitPanel phase={phase} mark={mark} />
    </div>
  )
}

function LimitPanel({ phase, mark }: { phase: "limit" | "reset"; mark: "tile" | "ring" }) {
  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-line bg-white">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line pr-2 pl-3">
        <ZoomReadout value="64%" />
        <ExportButton />
      </div>
      <div className="flex h-11 shrink-0 items-center justify-between pr-3 pl-3">
        <span className="flex h-6 items-center gap-1.5 rounded-[6px] pr-1.5 pl-1 text-xs text-quiet">
          <EditorIcon name="history" size={13} className="text-faint" />
          {creditsCopy.chatTitle}
          <EditorIcon name="chev" size={11} className="text-faint" />
        </span>
        <span className="flex items-center gap-0.5">
          <span className="flex size-6 items-center justify-center rounded-[6px]">
            <UsageMeter tone={phase === "limit" ? "limit" : "clear"} />
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 rounded-[7px] text-quiet active:translate-y-0"
            aria-label={creditsCopy.newChat}
          >
            <EditorIcon name="pen" size={15} />
          </Button>
        </span>
      </div>
      <Conversation>
        <ConversationContent>
          <Message from="user">
            <MessageContent className="rounded-[14px] bg-line px-3.5 py-2.5 leading-[1.5]">
              {creditsCopy.ask}
            </MessageContent>
            <span className="flex h-7 items-center gap-1.5 rounded-[8px] px-2 text-xs text-quiet shadow-[0px_0px_0px_1px_var(--field-edge)]">
              <EditorIcon name="doc" size={13} />
              {creditsCopy.notesFile}
            </span>
          </Message>
          <Message from="assistant">
            <Tool>
              <ToolHeader title={creditsCopy.readSlides} />
            </Tool>
            {phase === "limit" ? <LimitCard mark={mark} /> : <ResetCard />}
          </Message>
        </ConversationContent>
      </Conversation>
      <div className="flex flex-col px-3 pb-3">{phase === "limit" ? <LimitComposer /> : <ReadyComposer />}</div>
    </aside>
  )
}

function LimitMark({ mark }: { mark: "tile" | "ring" }) {
  if (mark === "ring") {
    return (
      <span className="flex size-4 items-center justify-center">
        <span className="size-3 rounded-full shadow-[0_0_0_1px_var(--destructive),inset_0_0_0_1px_var(--destructive)]" />
      </span>
    )
  }
  return (
    <span className="flex size-5 items-center justify-center rounded-[6px] bg-[linear-gradient(180deg,var(--danger-light),var(--destructive))] shadow-[0_1px_0_0_rgb(255_255_255/35%),0_0_0_1px_var(--danger-edge),0_1px_2px_rgb(0_0_0/12%)]">
      <span className="size-[6.6px] rounded-full shadow-[0_0_0_0.82px_var(--background),inset_0_0_0_0.82px_var(--background)]" />
    </span>
  )
}

function LimitCard({ mark }: { mark: "tile" | "ring" }) {
  return (
    <div className="flex flex-col gap-3 rounded-[12px] bg-white p-3.5 shadow-[0px_0px_0px_1px_var(--line),0px_1px_2px_var(--black-5)]">
      <span className="flex items-center gap-2">
        <LimitMark mark={mark} />
        <span className="text-[13px] leading-[17px] font-semibold text-foreground">{productCopy.usageLimitTitle}</span>
      </span>
      <p className="text-[12.5px] leading-[1.5] text-muted-foreground">{productCopy.usageLimitBody}</p>
      <span>
        <CardButton>{productCopy.usageResetAction}</CardButton>
      </span>
    </div>
  )
}

function ResetCard() {
  return (
    <div className="flex flex-col gap-3 rounded-[12px] bg-white p-3.5 shadow-[0px_0px_0px_1px_var(--line),0px_1px_2px_var(--black-5)]">
      <span className="flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-[6px] bg-[linear-gradient(180deg,var(--primary-top),var(--primary))] shadow-[0_1px_0_0_rgb(255_255_255/35%),0_0_0_1px_var(--primary-strong),0_1px_2px_rgb(0_0_0/12%)]">
          <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
            <path
              d="M2.3 5.7 4.3 7.7 8.7 3.3"
              fill="none"
              stroke="var(--background)"
              strokeWidth="1.65"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="text-[13px] leading-[17px] font-semibold text-foreground">{productCopy.historyReset}</span>
      </span>
      <p className="text-[12.5px] leading-[1.5] text-muted-foreground">{productCopy.agentResumeLine}</p>
      <span>
        <CardButton>{productCopy.agentResume}</CardButton>
      </span>
    </div>
  )
}

function CardButton({ children }: { children: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-8 items-center rounded-lg bg-[linear-gradient(180deg,var(--primary-top),var(--primary))] px-3 text-[13px] leading-[17px] font-medium text-white shadow-[0_1px_0_0_rgb(255_255_255/35%),0_0_0_1px_var(--primary-strong),0_1px_2px_rgb(0_0_0/12%)] hover:brightness-105"
    >
      {children}
    </button>
  )
}

function LimitComposer() {
  return (
    <PromptInput className="h-12 items-center pr-2 pl-3">
      <PromptInputBody>
        <PromptInputButton className="size-7 rounded-[7px] text-foreground" aria-label={creditsCopy.attach}>
          <EditorIcon name="plus" size={17} />
        </PromptInputButton>
        <PromptInputText>{productCopy.usageResets}</PromptInputText>
      </PromptInputBody>
      <PromptInputButton className="size-7 rounded-[7px] text-foreground" aria-label={creditsCopy.microphone}>
        <EditorIcon name="mic" size={17} />
      </PromptInputButton>
    </PromptInput>
  )
}

function ReadyComposer() {
  return (
    <PromptInput className="h-12 items-center pr-2 pl-3">
      <PromptInputBody>
        <PromptInputButton className="size-7 rounded-[7px] text-foreground" aria-label={creditsCopy.attach}>
          <EditorIcon name="plus" size={17} />
        </PromptInputButton>
        <PromptInputChip>
          {creditsCopy.slideChip}
          <EditorIcon name="x" size={11} className="text-faint" />
        </PromptInputChip>
        <PromptInputText>{creditsCopy.askAira}</PromptInputText>
      </PromptInputBody>
      <PromptInputButton className="size-7 rounded-[7px] text-foreground" aria-label={creditsCopy.microphone}>
        <EditorIcon name="mic" size={17} />
      </PromptInputButton>
    </PromptInput>
  )
}

function UsageMeter({ tone }: { tone: "limit" | "clear" }) {
  const dash = tone === "limit" ? "37.68 80" : "0.72 80"
  const color = tone === "limit" ? "var(--limit)" : "var(--primary)"
  return (
    <span className="relative block size-4">
      <span className="absolute top-0.5 left-0.5 size-3 rounded-full shadow-[0_0_0_1px_var(--field-edge),inset_0_0_0_1px_var(--field-edge)]" />
      <svg
        viewBox="0 0 12 12"
        width="12"
        height="12"
        className="absolute top-0.5 left-0.5 -rotate-90 overflow-visible"
        aria-hidden="true"
      >
        <circle
          cx="6"
          cy="6"
          r="5"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={dash}
        />
      </svg>
    </span>
  )
}
