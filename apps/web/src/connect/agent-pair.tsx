import { AirdesignMark } from "@/decks/airdesign-mark"
import { ClaudeMark, CodexMark } from "@/connect/agent-marks"

export function AgentPair({ agent }: { agent: "claude" | "codex" }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-12 items-center justify-center rounded-xl bg-white shadow-[0_0_0_1px_var(--field-edge)]">
        <AirdesignMark size={28} />
      </span>
      <span className="flex w-5 justify-between" aria-hidden="true">
        <span className="size-1 rounded-full bg-[var(--dot)]" />
        <span className="size-1 rounded-full bg-[var(--dot)]" />
        <span className="size-1 rounded-full bg-[var(--dot)]" />
      </span>
      <span
        className={
          agent === "claude"
            ? "flex size-12 items-center justify-center rounded-xl bg-claude text-white"
            : "flex size-12 items-center justify-center rounded-xl bg-ink text-white"
        }
      >
        {agent === "claude" ? <ClaudeMark /> : <CodexMark />}
      </span>
    </div>
  )
}
