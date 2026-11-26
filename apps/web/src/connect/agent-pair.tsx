import { AirdesignMark } from "@/components/ui/airdesign-mark"
import gemini from "@/components/ui/gemini-art.svg"
import { ClaudeMark, CodexMark } from "@/connect/agent-marks"

export type ConsentAgent = "claude" | "codex" | "gemini"

const lightTile = "flex size-12 items-center justify-center rounded-xl bg-white shadow-[0_0_0_1px_var(--field-edge)]"

export function AgentPair({ agent }: { agent: ConsentAgent | null }) {
  return (
    <div className="flex items-center gap-3">
      <span className={lightTile}>
        <AirdesignMark size={28} />
      </span>
      <span className="flex w-5 justify-between" aria-hidden="true">
        <span className="size-1 rounded-full bg-[var(--dot)]" />
        <span className="size-1 rounded-full bg-[var(--dot)]" />
        <span className="size-1 rounded-full bg-[var(--dot)]" />
      </span>
      {agent === "gemini" && (
        <span className={lightTile}>
          <img src={gemini} alt="" width={26} height={26} />
        </span>
      )}
      {(agent === "claude" || agent === "codex") && (
        <span
          className={
            agent === "claude"
              ? "flex size-12 items-center justify-center rounded-xl bg-claude text-white"
              : "flex size-12 items-center justify-center rounded-xl bg-ink text-white"
          }
        >
          {agent === "claude" ? <ClaudeMark /> : <CodexMark />}
        </span>
      )}
    </div>
  )
}
