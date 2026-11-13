import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AgentPair } from "@/connect/agent-pair"
import { connectPermissions, signedInAccount } from "@/connect/connect-copy"

const trimmed = "[text-box:trim-both_cap_alphabetic]"

export function ApproveAgent({
  agent,
  title,
  subtitle,
  ability,
  footer,
  screenTitle,
  account = signedInAccount,
  onDeny,
  onAllow,
  onSwitch,
  approving = false,
}: {
  agent: "claude" | "codex" | null
  title: string
  subtitle: string
  ability: string
  footer: string
  screenTitle: string
  account?: { initials: string; name: string; email: string }
  onDeny?: () => void
  onAllow?: () => void
  onSwitch?: () => void
  approving?: boolean
}) {
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
            {title}
          </h1>
          <p className={`flex h-[var(--space-16)] items-center text-[length:var(--type-dense)] text-faint ${trimmed}`}>
            {subtitle}
          </p>
        </header>
        <div className="flex h-[57px] w-full items-center gap-3 rounded-xl px-3">
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-navy text-[length:var(--type-caption)] font-semibold text-white ${trimmed}`}
          >
            {account.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[length:var(--type-dense)] leading-[17px] font-medium text-foreground">
              {account.name}
            </span>
            <span className="block text-[length:var(--type-caption)] leading-4 text-faint">{account.email}</span>
          </span>
          <button
            type="button"
            onClick={onSwitch}
            className={`relative text-[length:var(--type-dense)] leading-[17px] font-medium text-[color:var(--primary-strong)] active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[color:color-mix(in_oklch,var(--primary-strong),black_15%)] after:absolute after:inset-[min(0px,calc((100%-44px)/2))] after:content-[''] ${trimmed}`}
          >
            Switch
          </button>
        </div>
        <div className="flex w-full flex-col gap-2.5">
          <p className="ps-1 text-[length:var(--type-caption)] leading-4 font-medium text-muted-foreground">
            {ability}
          </p>
          <ul className="flex flex-col gap-2.5">
            {connectPermissions.map((permission) => (
              <li key={permission} className="flex h-[var(--space-16)] items-center gap-2.5 ps-1">
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0 text-faint">
                  <path
                    d="M2.92 7.29 5.54 9.92 11.08 4.38"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.02"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className={`text-[length:var(--type-dense)] leading-[17px] text-foreground ${trimmed}`}>
                  {permission}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex w-full gap-2">
          <Button
            type="button"
            variant="outline"
            className={`h-10 w-[176px] rounded-[var(--shape-card)] border-0 bg-white px-0 text-sm font-medium text-foreground shadow-[0_0_0_1px_var(--field-edge),0_1px_2px_0_rgb(0_0_0/4%)] hover:bg-white active:scale-[0.97] ${trimmed}`}
            onClick={onDeny}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            className={`h-10 w-[176px] rounded-[var(--shape-card)] px-0 text-sm font-medium active:scale-[0.97] ${trimmed}`}
            disabled={approving}
            onClick={onAllow}
          >
            Allow
          </Button>
        </div>
        <p className="w-full text-center text-[length:var(--type-caption)] leading-[var(--leading-body)] text-faint">
          {footer}
        </p>
      </section>
    </main>
  )
}
