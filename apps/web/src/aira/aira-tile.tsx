import { cn } from "@/lib/class-names"

export function AiraTile({ large = false }: { large?: boolean }) {
  const mark = large ? 20 : 16
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center bg-background shadow-[inset_0_0_0_1px_var(--line)]",
        large ? "size-10 rounded-[var(--shape-card)]" : "size-7 rounded-md",
      )}
    >
      <svg width={mark} height={mark} viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M3 13.67 L6.27 6.8 M13 13.67 L9.73 6.8"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9.33 1.07 C9.76 3.44 10.96 4.64 13.33 5.07 C10.96 5.5 9.76 6.7 9.33 9.07 C8.9 6.7 7.7 5.5 5.33 5.07 C7.7 4.64 8.9 3.44 9.33 1.07 Z"
          fill="var(--primary)"
        />
      </svg>
    </span>
  )
}
