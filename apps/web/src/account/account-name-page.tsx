import { AirdesignMark } from "@/components/ui/airdesign-mark"
import { Button } from "@/components/ui/button"
import { accountCopy } from "@/copy/account-copy"
import { settingsCopy } from "@/copy/settings-copy"
import { NameForm } from "@/account/name-form"

export function AccountNamePage({
  email,
  onSave,
  onSignOut,
}: {
  email: string
  onSave: (name: string) => void
  onSignOut: () => void
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center bg-canvas px-6 pt-[clamp(48px,14.3svh,132px)] pb-8 text-foreground">
      <div className="w-full max-w-110">
        <header className="flex flex-col items-center text-center">
          <AirdesignMark size={40} />
          <h1
            tabIndex={-1}
            ref={(heading) => heading?.focus()}
            style={{ outline: "none" }}
            className="mt-5 text-[26px] leading-[1.2] font-semibold tracking-[-0.5px]"
          >
            {accountCopy.nameTitle}
          </h1>
          <p className="mt-3 text-[length:var(--type-body)] leading-5 text-muted-foreground">{accountCopy.nameBody}</p>
        </header>
        <section className="mt-7 rounded-2xl border border-transparent bg-background p-8 shadow-[0_0_0_1px_var(--black-7),0_1px_2px_var(--black-3),0_12px_32px_var(--black-4)] max-sm:p-6">
          <NameForm name="" joining onSave={onSave} />
        </section>
        <div className="mt-6 flex min-w-0 flex-col items-center gap-1 text-center">
          <p className="max-w-full wrap-anywhere text-[length:var(--type-dense)] leading-5 text-muted-foreground">
            {email}
          </p>
          <Button variant="link" className="text-[length:var(--type-dense)] text-muted-foreground" onClick={onSignOut}>
            {settingsCopy.signOut}
          </Button>
        </div>
      </div>
    </main>
  )
}

export function AccountNameScreen() {
  return <AccountNamePage email="ada@halden.com" onSave={() => undefined} onSignOut={() => undefined} />
}
