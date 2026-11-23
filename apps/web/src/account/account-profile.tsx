import { AccountNamePage } from "@/account/account-name-page"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { loadAccount, type AccountLoad } from "@/account/account-load"
import { signOut } from "@/account/sign-out"

type Profile = { name: string | null; save: (name: string) => void }
const ProfileContext = createContext<Profile | null>(null)
export function useAccountProfile() {
  return useContext(ProfileContext)
}

export function AccountProfile({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AccountLoad | null>(null)
  async function refresh() {
    const next = await loadAccount()
    if (next.kind === "account") setAccount(next)
  }
  useEffect(() => {
    void Promise.resolve().then(refresh)
  }, [])
  function save(name: string) {
    if (account?.kind !== "account") {
      void refresh()
      return
    }
    setAccount((current) => (current?.kind === "account" ? { ...current, name } : current))
  }
  if (account?.kind !== "account" || account.name !== null)
    return (
      <ProfileContext value={{ name: account?.kind === "account" ? account.name : null, save }}>
        {children}
      </ProfileContext>
    )
  return <AccountNamePage email={account.email} onSave={save} onSignOut={() => void signOut()} />
}
