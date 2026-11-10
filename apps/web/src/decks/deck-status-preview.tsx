const trimmed = { textBox: "trim-both cap alphabetic" } as const

function PptxMark() {
  return (
    <span
      className="flex size-10 items-center justify-center rounded-[var(--shape-card)] bg-line text-[length:var(--type-caption)] leading-[13px] font-semibold text-muted-foreground"
      style={trimmed}
    >
      PPTX
    </span>
  )
}

export function ImportingPreview() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-3 bg-canvas">
      <PptxMark />
      <span className="block h-1 w-40 overflow-hidden rounded-sm bg-line">
        <span className="block h-full w-[93px] rounded-sm bg-[linear-gradient(90deg,var(--primary-top),var(--primary))]" />
      </span>
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 344.66 200"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <rect
          x="1"
          y="1"
          width="342.66"
          height="198"
          rx="9"
          fill="none"
          stroke="var(--field-edge)"
          strokeWidth="2"
          strokeDasharray="5 4"
        />
      </svg>
    </div>
  )
}

export function ImportFailedPreview() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-background shadow-[inset_0_0_0_1px_var(--line)]">
      <PptxMark />
      <div className="flex translate-y-[-0.5px] items-center gap-4">
        <button
          type="button"
          className="flex h-8 w-[145.83px] items-center rounded-lg border-0 bg-background px-3 text-[length:var(--type-dense)] leading-[17px] font-medium text-foreground shadow-[inset_0_0_0_1px_var(--field-edge)]"
          style={trimmed}
        >
          Choose another file
        </button>
        <button
          type="button"
          className="border-0 bg-transparent text-[length:var(--type-dense)] leading-[17px] font-medium text-muted-foreground"
          style={trimmed}
        >
          Remove
        </button>
      </div>
    </div>
  )
}
