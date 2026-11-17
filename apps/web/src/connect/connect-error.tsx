import { buttonVariants } from "@/components/ui/button"
import { refusedConnect, unavailableConnect } from "@/copy/connect-copy"

export function ConnectError({ kind }: { kind: "refused" | "unavailable" }) {
  const copy = kind === "unavailable" ? unavailableConnect : refusedConnect
  const href = kind === "unavailable" ? window.location.pathname + window.location.search : "/"
  return (
    <main className="screen-frame grid place-items-center">
      <section className="flex w-[360px] flex-col items-center gap-6 text-center" aria-labelledby="connect-error">
        <header className="flex flex-col gap-2">
          <h1 id="connect-error" className="text-[length:var(--type-title)] font-semibold text-foreground">
            {copy.title}
          </h1>
          <p className="text-[length:var(--type-dense)] text-quiet">{copy.body}</p>
        </header>
        <a href={href} className={buttonVariants()}>
          {copy.action}
        </a>
      </section>
    </main>
  )
}
