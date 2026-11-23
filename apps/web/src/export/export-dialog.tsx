import { useId, useRef, type FormEvent, type ReactNode, type RefObject } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogOverlay, DialogPopup, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { rangeProblem, type ExportChoice, type SlideChoice } from "@/export/export-choice"
import { exportCopy } from "@/copy/export-copy"
import { formatNames, slideNames, type ExportFormat } from "@/export/export-options"

const fieldEdge = "shadow-[0_0_0_1px_var(--field-edge)]"
const fieldText = "text-[length:var(--type-dense)] leading-[17px] text-foreground"

function CloseMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M4 4 L12 12 M12 4 L4 12"
        fill="none"
        stroke="var(--muted-foreground)"
        strokeWidth="1.17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function OptionRow({ label, labelId, children }: { label: string; labelId: string; children: ReactNode }) {
  return (
    <div className="flex h-9 items-center">
      <span
        id={labelId}
        className="w-[110px] shrink-0 text-[length:var(--type-dense)] leading-[17px] text-muted-foreground"
      >
        {label}
      </span>
      <div className="ml-4 flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  )
}

function OptionSelect<T extends string>({
  labelId,
  value,
  names,
  disabled,
  onValue,
}: {
  labelId: string
  value: T
  names: Readonly<Partial<Record<T, string>>>
  disabled: boolean
  onValue: (value: T) => void
}) {
  const values = Object.keys(names) as T[]
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== null && values.includes(next as T)) onValue(next as T)
      }}
    >
      <SelectTrigger
        aria-labelledby={labelId}
        className={`h-9 w-full rounded-lg border-0 bg-white pr-3 pl-3 data-[size=default]:h-9 ${fieldEdge} ${fieldText}`}
      >
        <SelectValue>{(selected: T | null) => names[selected ?? value] ?? ""}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {values.map((each) => (
          <SelectItem key={each} value={each}>
            {names[each]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function SlideNumber({
  label,
  value,
  count,
  invalid,
  problemId,
  disabled,
  onValue,
}: {
  label: string
  value: string
  count: number
  invalid: boolean
  problemId: string
  disabled: boolean
  onValue: (value: string) => void
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      max={count}
      aria-label={label}
      aria-invalid={invalid}
      aria-describedby={invalid ? problemId : undefined}
      disabled={disabled}
      value={value}
      onChange={(event) => onValue(event.target.value)}
      className={`h-9 w-20 rounded-lg bg-white px-3 ${fieldEdge} ${fieldText}`}
    />
  )
}

export function ExportDialog({
  choice,
  count,
  open = true,
  exporting = false,
  onChoice = () => undefined,
  onExport = () => undefined,
  onClose = () => undefined,
  finalFocus,
}: {
  choice: ExportChoice
  count: number
  open?: boolean
  exporting?: boolean
  onChoice?: (choice: ExportChoice) => void
  onExport?: () => void
  onClose?: () => void
  finalFocus?: RefObject<HTMLElement | null>
}) {
  const fileTypeId = useId()
  const slidesId = useId()
  const rangeId = useId()
  const problemId = useId()
  const exportButton = useRef<HTMLButtonElement>(null)
  const problem = rangeProblem(choice, count)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (problem === null && !exporting) onExport()
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogPortal>
        <DialogOverlay className="bg-black/30" />
        <DialogPopup
          initialFocus={exportButton}
          {...(finalFocus === undefined ? {} : { finalFocus })}
          data-export-dialog={exporting ? "exporting" : "choosing"}
          aria-busy={exporting}
          className="fixed top-1/2 left-1/2 z-50 w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-[var(--shape-dialog)] bg-white shadow-[0_24px_64px_rgb(0_0_0/25%)] outline-none"
        >
          <form onSubmit={submit}>
            <div className="flex h-14 items-center justify-between border-b border-line pr-3 pl-5">
              <DialogTitle className="text-[length:var(--type-section)] leading-5 font-semibold text-foreground">
                {exportCopy.title}
              </DialogTitle>
              <DialogClose
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-canvas"
                aria-label={exportCopy.close}
              >
                <CloseMark />
              </DialogClose>
            </div>
            <div className="flex flex-col gap-3 px-5 py-5">
              <OptionRow label={exportCopy.fileType} labelId={fileTypeId}>
                <OptionSelect<ExportFormat>
                  labelId={fileTypeId}
                  value={choice.format}
                  names={formatNames}
                  disabled={exporting}
                  onValue={(format) => onChoice({ ...choice, format })}
                />
              </OptionRow>
              <OptionRow label={exportCopy.slides} labelId={slidesId}>
                <OptionSelect<SlideChoice>
                  labelId={slidesId}
                  value={choice.slides}
                  names={slideNames}
                  disabled={exporting}
                  onValue={(slides) => onChoice({ ...choice, slides })}
                />
              </OptionRow>
              {choice.slides === "range" ? (
                <OptionRow label={exportCopy.range} labelId={rangeId}>
                  <SlideNumber
                    label={exportCopy.from}
                    value={choice.from}
                    count={count}
                    invalid={problem !== null}
                    problemId={problemId}
                    disabled={exporting}
                    onValue={(from) => onChoice({ ...choice, from })}
                  />
                  <span className="text-[length:var(--type-dense)] text-muted-foreground" aria-hidden="true">
                    –
                  </span>
                  <SlideNumber
                    label={exportCopy.to}
                    value={choice.to}
                    count={count}
                    invalid={problem !== null}
                    problemId={problemId}
                    disabled={exporting}
                    onValue={(to) => onChoice({ ...choice, to })}
                  />
                </OptionRow>
              ) : null}
              {problem === null ? null : (
                <p id={problemId} role="alert" className="pl-[126px] text-[length:var(--type-dense)] text-danger-text">
                  {problem}
                </p>
              )}
              <p className="text-[length:var(--type-dense)] leading-[17px] text-muted-foreground">
                {exportCopy.printWindow}
              </p>
            </div>
            <div className="border-t border-line">
              <div className="flex h-[60px] items-center justify-end gap-2 px-5">
                {exporting ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-lg px-3 text-[length:var(--type-dense)] leading-[17px] font-medium"
                    onClick={onClose}
                  >
                    {exportCopy.cancel}
                  </Button>
                ) : null}
                <Button
                  ref={exportButton}
                  type="submit"
                  focusableWhenDisabled
                  variant="default"
                  disabled={exporting || problem !== null}
                  {...(problem === null ? {} : { "aria-describedby": problemId })}
                  className={`h-9 min-w-[73.25px] rounded-lg px-3 text-[length:var(--type-dense)] leading-[17px] font-medium ${problem === null ? "" : "opacity-50"}`}
                >
                  {exporting ? exportCopy.exporting : exportCopy.action}
                </Button>
              </div>
            </div>
          </form>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
