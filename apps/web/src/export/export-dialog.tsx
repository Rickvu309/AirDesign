import { Dialog as BaseDialog } from "@base-ui/react/dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import { exportCopy, exportOptions, type ExportFormat } from "@/export/export-options"

function FieldChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M3.5 5.25 L7 8.75 L10.5 5.25"
        fill="none"
        stroke="#909090"
        strokeWidth="1.02"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CloseMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M4 4 L12 12 M12 4 L4 12"
        fill="none"
        stroke="#666666"
        strokeWidth="1.17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function OptionField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-9 items-center">
      <span className="w-[110px] shrink-0 text-[13px] leading-[17px] text-muted-foreground">{label}</span>
      <span className="ml-4 flex h-9 min-w-0 flex-1 items-center justify-between rounded-lg bg-white pr-3 pl-3 shadow-[0_0_0_1px_#d7d7d6]">
        <span className="text-[13px] leading-[17px] text-foreground">{value}</span>
        <FieldChevron />
      </span>
    </div>
  )
}

export function ExportDialog({ format }: { format: ExportFormat }) {
  return (
    <Dialog open>
      <DialogPortal>
        <DialogOverlay
          className="bg-black/30 duration-0 data-open:animate-none"
          style={{ backdropFilter: "none", animation: "none" }}
        />
        <BaseDialog.Popup
          initialFocus={false}
          className={
            format === "pdf"
              ? "fixed top-[317px] left-[495px] z-50 w-[480px] rounded-[14px] bg-white shadow-[0_24px_64px_rgb(0_0_0/25%)] outline-none"
              : "fixed top-[341px] left-[495px] z-50 w-[480px] rounded-[14px] bg-white shadow-[0_24px_64px_rgb(0_0_0/25%)] outline-none"
          }
        >
          <div className="flex h-14 items-center justify-between border-b border-line pr-3 pl-5">
            <DialogTitle className="text-[15px] leading-5 font-semibold text-foreground">
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
            {exportOptions[format].map((option) => (
              <OptionField key={option.label} label={option.label} value={option.value} />
            ))}
          </div>
          <div className="border-t border-line">
            <div className="flex h-[60px] items-center justify-end px-5">
              <Button
                type="button"
                variant="brand"
                className="h-9 w-[73.25px] rounded-lg px-0 text-[13px] leading-[17px] font-medium"
              >
                {exportCopy.action}
              </Button>
            </div>
          </div>
        </BaseDialog.Popup>
      </DialogPortal>
    </Dialog>
  )
}
