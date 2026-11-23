import { Button } from "@/components/ui/button"
import { productCopy } from "@/copy/product-copy"

export type NewDeckActions = { onBlank?: () => void }

export function NewDeckButton({ onBlank }: NewDeckActions) {
  return (
    <Button
      variant="signature"
      className="h-7 gap-1.5 px-3 text-[length:var(--type-dense)]"
      type="button"
      onClick={onBlank}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" className="size-3.5" aria-hidden="true">
        <path
          d="M7 2.92 V11.08 M2.92 7 H11.08"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.28"
          strokeLinecap="round"
        />
      </svg>
      {productCopy.newDeck}
    </Button>
  )
}
