import { useRef, type Ref } from "react"
import { Button } from "@/components/ui/button"
import { productCopy } from "@/copy/product-copy"
import { ExportDialog } from "@/export/export-dialog"
import type { ExportFlow } from "@/export/export-flow"
import { PrintSheet } from "@/export/print-sheet"

function ExportButton({ onClick, ref }: { readonly onClick: () => void; readonly ref: Ref<HTMLButtonElement> }) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="default"
      className="h-8 rounded-lg px-3 text-[length:var(--type-dense)] font-medium active:translate-y-0"
      onClick={onClick}
    >
      {productCopy.exportDeck}
    </Button>
  )
}

export function ExportControl({ flow }: { readonly flow: ExportFlow }) {
  const button = useRef<HTMLButtonElement>(null)
  const { target, open, choice, printing } = flow.control
  return (
    <>
      <ExportButton ref={button} onClick={flow.control.openDialog} />
      <ExportDialog
        open={open}
        choice={choice}
        count={target.slides.length}
        skipped={target.skipped}
        exporting={open && printing !== null}
        finalFocus={button}
        onChoice={flow.control.setChoice}
        onExport={() => flow.control.print(choice)}
        onClose={flow.control.close}
      />
      {printing === null ? null : (
        <PrintSheet
          key={printing.run}
          view={printing.view}
          slides={printing.slides}
          name={target.name}
          assetUrl={target.assetUrl}
          onReady={() => flow.control.ready(printing.run)}
          onPrinted={() => flow.control.printed(printing.run)}
          onFailed={() => flow.control.fail(printing.run)}
        />
      )}
    </>
  )
}
