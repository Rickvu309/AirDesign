import { useEffect, useState } from "react"
import { NotFound, type NotFoundKind } from "@/decks/not-found"
import { loadAccount } from "@/account/account-load"
import { signOut } from "@/account/sign-out"
import { signInAddress } from "@/account/sign-in-address"

export function NotFoundPage({ kind }: { kind: NotFoundKind }) {
  const [email, setEmail] = useState("")
  useEffect(() => {
    let live = true
    void loadAccount().then((loaded) => {
      if (!live) return
      if (loaded.kind === "signed-out") window.location.assign(signInAddress(window.location))
      else if (loaded.kind === "account") setEmail(loaded.email)
    })
    return () => {
      live = false
    }
  }, [])
  return <NotFound live kind={kind} account={{ email }} onSignOut={() => void signOut()} />
}
