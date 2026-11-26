import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AgentPair, type ConsentAgent } from "@/connect/agent-pair"
import { connectPermissions, signedInAccount } from "@/copy/connect-copy"
import { cn } from "@/lib/class-names"

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
  agent: ConsentAgent | null
  title: string
  subtitle: string
  ability: string
  footer: string
  screenTitle: string
  account?: { initials: string; name?: string; email: string }
  onDeny?: () => void
  onAllow?: () => void
  onSwitch?: () => void
  approving?: boolean
}) {
  useEffect(() => {
    document.title = screenTitle
  }, [screenTitle])

  return (
    <main className="screen-frame reflow-frame grid place-items-center px-4 py-6">
      <section className="flex w-full max-w-90 flex-col items-center gap-6">
        <AgentPair agent={agent} />
        <header className="flex flex-col items-center gap-1.5 text-center">
          <h1
            className={cn(
              "flex min-h-7 items-center justify-center text-balance [overflow-wrap:anywhere] text-[length:var(--type-title)] font-semibold tracking-dialog-title text-foreground",
              trimmed,
            )}
          >
            {title}
          </h1>
          <p
            className={cn(
              "flex min-h-[var(--space-16)] items-center justify-center text-balance [overflow-wrap:anywhere] text-[length:var(--type-dense)] text-quiet",
              trimmed,
            )}
          >
            {subtitle}
          </p>
        </header>
        <div className="flex min-h-14.25 w-full items-center gap-3 rounded-xl px-3">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full bg-navy text-[length:var(--type-caption)] font-semibold text-white",
              trimmed,
            )}
          >
            {account.initials}
          </span>
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <span className="block text-[length:var(--type-dense)] leading-ui-tight font-medium text-foreground">
              {account.name || account.email}
            </span>
            {account.name && account.name !== account.email && (
              <span className="block text-[length:var(--type-caption)] leading-4 text-quiet">{account.email}</span>
            )}
          </span>
          <button
            type="button"
            onClick={onSwitch}
            disabled={approving}
            className={cn(
              "relative shrink-0 disabled:pointer-events-none disabled:opacity-50 text-[length:var(--type-dense)] leading-ui-tight font-medium text-[color:var(--primary-strong)] motion-safe:enabled:active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-strong-hover after:absolute after:inset-[min(0px,calc((100%-44px)/2))] after:content-['']",
              trimmed,
            )}
          >
            Switch
          </button>
        </div>
        <div className="flex w-full flex-col gap-2.5">
          <p className="ps-1 [overflow-wrap:anywhere] text-[length:var(--type-caption)] leading-4 font-medium text-muted-foreground">
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
                <span className={cn("text-[length:var(--type-dense)] leading-ui-tight text-foreground", trimmed)}>
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
            size="consent"
            className="flex-1"
            disabled={approving}
            onClick={onDeny}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            size="consent"
            className="flex-1"
            disabled={approving}
            aria-busy={approving}
            onClick={onAllow}
          >
            {approving ? "Allowing…" : "Allow"}
          </Button>
        </div>
        <p className="w-full text-center text-[length:var(--type-caption)] leading-[var(--leading-body)] text-quiet">
          {footer}
        </p>
      </section>
    </main>
  )
}
