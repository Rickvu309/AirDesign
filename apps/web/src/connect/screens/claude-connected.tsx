import { useEffect } from "react"
import { AgentPair } from "@/connect/agent-pair"
import { claudeConnect } from "@/connect/connect-copy"

const trimmed = "[text-box:trim-both_cap_alphabetic]"

export function ClaudeConnected() {
  useEffect(() => {
    document.title = claudeConnect.connectedScreenTitle
  }, [])

  return (
    <main className="screen-frame grid place-items-center">
      <section className="flex w-[360px] flex-col items-center gap-6">
        <AgentPair agent="claude" />
        <header className="flex flex-col items-center gap-1.5 text-center">
          <h1
            className={`flex h-7 items-center text-[20px] font-semibold tracking-[-0.3px] text-foreground ${trimmed}`}
          >
            {claudeConnect.connectedTitle}
          </h1>
          <p className={`flex h-[17px] items-center text-[13px] text-faint ${trimmed}`}>
            {claudeConnect.connectedSubtitle}
          </p>
        </header>
      </section>
    </main>
  )
}
