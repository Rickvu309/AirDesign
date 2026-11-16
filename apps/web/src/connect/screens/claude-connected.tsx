import { useEffect } from "react"
import { AgentPair } from "@/connect/agent-pair"
import { claudeConnect, connectedCopy } from "@/connect/connect-copy"

const trimmed = "[text-box:trim-both_cap_alphabetic]"

export function ClaudeConnected({
  agent = "claude",
  name = "Claude",
  screenTitle = claudeConnect.connectedScreenTitle,
}: {
  agent?: "claude" | "codex" | null
  name?: string
  screenTitle?: string
}) {
  const copy = connectedCopy(name)

  useEffect(() => {
    document.title = screenTitle
  }, [screenTitle])

  return (
    <main className="screen-frame grid place-items-center">
      <section className="flex w-[360px] flex-col items-center gap-6">
        <AgentPair agent={agent} />
        <header className="flex flex-col items-center gap-1.5 text-center">
          <h1
            className={`flex h-7 items-center text-[length:var(--type-title)] font-semibold tracking-[-0.3px] text-foreground ${trimmed}`}
          >
            {copy.title}
          </h1>
          <p className={`flex h-[var(--space-16)] items-center text-[length:var(--type-dense)] text-quiet ${trimmed}`}>
            {copy.subtitle}
          </p>
        </header>
      </section>
    </main>
  )
}
