import { useId, useState } from "react"
import { accountNameLimit, accountRoutes, readAccountName } from "@airdesign/catalog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/class-names"
import { accountCopy } from "@/copy/account-copy"

export function NameForm({
  name,
  onSave,
  joining = false,
}: {
  name: string
  onSave: (name: string) => void
  joining?: boolean
}) {
  const id = useId()
  const [value, setValue] = useState(name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  async function save() {
    const parsed = readAccountName({ name: value })
    if (!parsed.ok) {
      setError(accountCopy.nameInvalid)
      return
    }
    setBusy(true)
    setError("")
    setSaved(false)
    try {
      const response = await fetch(accountRoutes.name.path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: parsed.name }),
      })
      if (!response.ok) throw new Error("name")
      setValue(parsed.name)
      onSave(parsed.name)
      setSaved(true)
    } catch {
      setError(accountCopy.nameFailed)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      className={cn(
        "grid gap-x-6 gap-y-2",
        joining ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_minmax(0,360px)] max-sm:grid-cols-1",
      )}
      onSubmit={(event) => {
        event.preventDefault()
        if (!busy) void save()
      }}
    >
      <div className={joining ? "" : "pt-2 max-sm:pt-0"}>
        <label htmlFor={id} className="text-[length:var(--type-body)] leading-5 font-medium">
          {accountCopy.name}
        </label>
        {!joining && (
          <p id={`${id}-hint`} className="mt-1 text-[length:var(--type-dense)] leading-5 text-muted-foreground">
            {accountCopy.nameShown}
          </p>
        )}
      </div>
      <div className="min-w-0">
        <div className={cn("flex gap-2", joining && "flex-col gap-5")}>
          <Input
            id={id}
            name="name"
            autoComplete="name"
            required
            maxLength={accountNameLimit}
            disabled={busy}
            value={value}
            className={cn(
              "bg-background",
              joining ? "h-11 px-3.5 text-base" : "h-9 text-[length:var(--type-body)] max-sm:h-11",
            )}
            aria-describedby={`${id}-error${joining ? "" : ` ${id}-hint`}`}
            aria-invalid={error !== ""}
            onChange={(event) => {
              setValue(event.target.value)
              setError("")
              setSaved(false)
            }}
          />
          <Button
            type="submit"
            variant={joining ? "default" : "outline"}
            className={joining ? "h-11 w-full text-[length:var(--type-section)]" : "h-9 px-3.5 max-sm:h-11"}
            disabled={busy || (!joining && value.trim() === name)}
          >
            {busy ? accountCopy.nameSaving : joining ? accountCopy.nameContinue : accountCopy.nameSave}
          </Button>
        </div>
        <div className="mt-2 min-h-5 text-[length:var(--type-dense)] leading-5">
          <p id={`${id}-error`} role="alert" className="text-danger-text">
            {error}
          </p>
          <p role="status" className="text-muted-foreground">
            {saved ? accountCopy.nameSaved : ""}
          </p>
        </div>
      </div>
    </form>
  )
}
