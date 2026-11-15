export function SampleSlide({ name }: { name: string }) {
  return (
    <svg width="100%" height="100%" viewBox="-12 -12 184 114" aria-hidden="true" className="block">
      <rect width="160" height="90" rx="1" fill="white" stroke="var(--field-edge)" vectorEffect="non-scaling-stroke" />
      <text x="14" y="48" fontSize="10" fontWeight="600" fill="black">
        {name}
      </text>
      <rect x="14" y="56" width="40" height="2.5" rx="1" fill="var(--primary)" />
      <text x="14" y="72" fontSize="5.5" fill="var(--quiet)">
        AirDesign
      </text>
    </svg>
  )
}
