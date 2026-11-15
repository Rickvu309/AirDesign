import { buttonVariants } from "@/components/ui/button"
import { productCopy } from "@/copy/product-copy"
import { DecksShell } from "@/decks/decks-shell"

const words = {
  deck: { title: productCopy.deckNotFoundTitle, body: productCopy.deckNotFoundBody },
  address: { title: productCopy.addressNotFoundTitle, body: productCopy.addressNotFoundBody },
} as const

export type NotFoundKind = keyof typeof words

export function NotFound({
  kind,
  account,
  onSignOut,
}: {
  kind: NotFoundKind
  account?: { email: string }
  onSignOut?: () => void
}) {
  return (
    <div className="screen-frame reflow-frame" data-not-found={kind}>
      <DecksShell account={account} onSignOut={onSignOut}>
        <h1 className="h-[39px] text-[26px] leading-[var(--leading-body)] font-semibold tracking-[-0.5px] text-foreground">
          {words[kind].title}
        </h1>
        <p className="mt-2 text-[length:var(--type-body)] leading-[var(--leading-body)] text-muted-foreground">
          {words[kind].body}
        </p>
        <a href="/" className={buttonVariants({ size: "lg", className: "mt-6 h-9 px-3.5" })}>
          {productCopy.goToDecks}
        </a>
      </DecksShell>
    </div>
  )
}
