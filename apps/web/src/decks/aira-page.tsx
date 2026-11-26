import { deckRoutes } from "@airdesign/catalog"
import { useEffect, useState } from "react"
import { signOut } from "@/account/sign-out"
import { AiraTile } from "@/components/ui/aira-tile"
import { productCopy } from "@/copy/product-copy"
import { post } from "@/decks/deck-request"
import { DecksShell } from "@/decks/decks-shell"
import { DescribeDeck } from "@/decks/describe-deck"
import { discardOpening } from "@/decks/discard-opening"
import { handFirstRequest, openingDeck, peekFirstRequest } from "@/lib/first-request"

type Listed = { readonly deck: string; readonly name: string; readonly starred?: boolean }
type Account = { readonly email: string; readonly starred: readonly Listed[] }

export function AiraStart({
  account,
  initial,
  onDescribe,
  onNavigate,
}: {
  account?: Account
  initial?: string
  onDescribe: (text: string) => void
  onNavigate?: (path: string) => void
}) {
  return (
    <div className="screen-frame reflow-frame">
      <DecksShell
        active="aira"
        {...(account ? { account, starred: account.starred, onSignOut: () => void signOut(), onNavigate } : {})}
      >
        <div
          data-aira-start
          className="flex h-full flex-col items-center justify-center bg-[radial-gradient(520px_240px_at_50%_52%,var(--blue-tint),transparent_72%)] pb-24 max-md:justify-start max-md:bg-none max-md:pt-10 max-md:pb-8"
        >
          <AiraTile large />
          <h1 className="mt-6 mb-9 text-center text-[length:var(--type-display)] leading-[var(--leading-display)] font-semibold tracking-[-0.035em] text-foreground max-md:text-[length:var(--type-title)]">
            {productCopy.storyHeadline}
          </h1>
          <DescribeDeck initial={initial} onDescribe={onDescribe} />
        </div>
      </DecksShell>
    </div>
  )
}

export function AiraPage({ navigate }: { navigate: (path: string) => void }) {
  const [account, setAccount] = useState<Account>({ email: "", starred: [] })
  useEffect(() => {
    async function refresh() {
      const noted = openingDeck()
      if (noted !== undefined) await discardOpening(noted)
      const listing = await post(deckRoutes.list.path, {}).catch(() => ({ ok: false }))
      if (listing.ok)
        setAccount({
          email: listing.account.email,
          starred: listing.decks.filter((deck: Listed) => deck.starred === true),
        })
    }
    void refresh()
    const focused = () => void refresh()
    window.addEventListener("focus", focused)
    return () => window.removeEventListener("focus", focused)
  }, [])
  return (
    <AiraStart
      account={account}
      initial={peekFirstRequest() ?? ""}
      onNavigate={navigate}
      onDescribe={(text) => {
        handFirstRequest(text)
        navigate("/s")
      }}
    />
  )
}
