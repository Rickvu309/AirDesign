export function UsageRing({ fraction }: { fraction: number }) {
  const dash = (2 * Math.PI * 7.5 * fraction).toFixed(1)
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" fill="none" stroke="var(--field-edge)" strokeWidth="2.5" />
      {fraction > 0 ? (
        <circle
          cx="10"
          cy="10"
          r="7.5"
          fill="none"
          stroke={fraction >= 1 ? "var(--destructive)" : "var(--primary)"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${dash} 100`}
          transform="rotate(-90 10 10)"
        />
      ) : null}
    </svg>
  )
}
