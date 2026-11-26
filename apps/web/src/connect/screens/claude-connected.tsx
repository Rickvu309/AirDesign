import { useEffect } from "react"
import { AgentPair, type ConsentAgent } from "@/connect/agent-pair"
import { claudeConnect, connectedCopy } from "@/copy/connect-copy"

const trimmed = "[text-box:trim-both_cap_alphabetic]"

export function ClaudeConnected({
  agent = "claude",
  name = "Claude",
  screenTitle = claudeConnect.connectedScreenTitle,
}: {
  agent?: ConsentAgent | null
  name?: string
  screenTitle?: string
}) {
  const copy = connectedCopy(name)

  useEffect(() => {
    document.title = screenTitle
  }, [screenTitle])

  return (
    <main className="screen-frame reflow-frame grid place-items-center px-4 py-6">
      <section className="flex w-full max-w-[360px] flex-col items-center gap-6">
        <AgentPair agent={agent} />
        <header className="flex flex-col items-center gap-1.5 text-center">
          <h1
            className={`flex min-h-7 items-center justify-center text-balance [overflow-wrap:anywhere] text-[length:var(--type-title)] font-semibold tracking-[-0.3px] text-foreground ${trimmed}`}
          >
            {copy.title}
          </h1>
          <p
            className={`flex min-h-[var(--space-16)] items-center justify-center text-balance [overflow-wrap:anywhere] text-[length:var(--type-dense)] text-quiet ${trimmed}`}
          >
            {copy.subtitle}
          </p>
        </header>
      </section>
    </main>
  )
}
