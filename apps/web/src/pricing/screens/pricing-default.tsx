import { Button } from "@/components/ui/button"
import { AirdesignMark } from "@/components/ui/airdesign-mark"
import { pricingCopy, pricingFeatures } from "@/pricing/pricing-plan"

function FeatureCheck() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" className="shrink-0 text-primary" aria-hidden="true">
      <path
        d="M3.13 7.81 5.94 10.63 11.88 4.69"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.09"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PricingDefault() {
  return (
    <div className="screen-frame">
      <header className="flex h-16 items-center justify-between px-8">
        <a href="" className="flex items-center gap-2 text-foreground">
          <AirdesignMark size={22} />
          <span className="text-[length:var(--type-section)] leading-[1.33] font-semibold">{pricingCopy.brand}</span>
        </a>
        <nav className="flex items-center gap-6" aria-label={pricingCopy.pricing}>
          <a
            href=""
            className="text-[length:var(--type-dense)] leading-[1.31] font-medium text-foreground"
            aria-current="page"
          >
            {pricingCopy.pricing}
          </a>
          <a href="" className="text-[length:var(--type-dense)] leading-[1.31] font-normal text-muted-foreground">
            {pricingCopy.signIn}
          </a>
          <Button variant="outline" className="h-8 px-3 text-[length:var(--type-dense)] leading-[1.31]" type="button">
            {pricingCopy.startFree}
          </Button>
        </nav>
      </header>
      <main className="flex flex-col items-center">
        <h1 className="mt-20 text-[52px] leading-[1.31] font-semibold tracking-[-1.5px] text-foreground">
          {pricingCopy.title}
        </h1>
        <p className="mt-3 text-[18px] leading-[1.56] text-muted-foreground">{pricingCopy.subtitle}</p>
        <section className="mt-12 flex w-[440px] flex-col gap-6 rounded-3xl bg-white p-7 shadow-[inset_0_0_0_1px_var(--sheet),0_12px_40px_0_rgb(0_0_0/5%)]">
          <div className="flex h-14 items-end gap-2">
            <p className="text-[56px] leading-none font-semibold tracking-[-1.5px] text-foreground">
              {pricingCopy.price}
            </p>
            <p className="flex h-[var(--space-32)] items-start text-[length:var(--type-section)] leading-[1.5] text-quiet">
              {pricingCopy.forever}
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {pricingFeatures.map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-2.5 text-[length:var(--type-body)] leading-[1.43] text-foreground"
              >
                <FeatureCheck />
                {feature}
              </li>
            ))}
          </ul>
          <Button
            variant="default"
            className="h-11 w-full rounded-[var(--shape-card)] text-[length:var(--type-section)] leading-[1.33]"
            type="button"
          >
            {pricingCopy.startFree}
          </Button>
        </section>
        <p className="mt-8 text-[length:var(--type-dense)] leading-[1.31] text-quiet">{pricingCopy.note}</p>
      </main>
    </div>
  )
}
