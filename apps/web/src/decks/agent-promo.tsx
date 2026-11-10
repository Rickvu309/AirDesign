import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { promoFill, promoMark, promoSlash } from "@/decks/agent-promo-art"
import { claudeLogo, openAiLogo } from "@/decks/agent-logos"
import { DeckGlyph } from "@/decks/deck-glyph"
import { deckRoutes } from "@/decks/deck-routes"

export function AgentPromo() {
  return (
    <section className="h-[254.31px] w-[224px] shrink-0 overflow-hidden rounded-[var(--shape-dialog)] bg-background shadow-[0_0_0_1px_var(--line),0_4px_12px_rgb(0_0_0/4%)]">
      <div
        className="relative h-[112px]"
        style={{
          backgroundImage:
            "radial-gradient(50% 50% at 50% 55%, rgb(77 148 251 / 16%) 0%, rgb(77 148 251 / 5%) 45%, rgb(77 148 251 / 0%) 72%)",
        }}
      >
        <span className="absolute top-[-48px] left-[2px] size-[220px] rounded-full shadow-[0_0_0_1px_rgb(77_148_251/14%)]" />
        <span className="absolute top-[-13px] left-[37px] size-[150px] rounded-full shadow-[0_0_0_1px_rgb(77_148_251/18%)]" />
        <span className="absolute top-[20px] left-[70px] size-[84px] rounded-full shadow-[0_0_0_1px_rgb(77_148_251/26%)]" />
        <span className="absolute top-[45px] left-[-12px] flex size-9 items-center justify-center rounded-[var(--shape-card)] bg-ink text-white shadow-[0_4px_10px_rgb(0_0_0/14%)]">
          <span dangerouslySetInnerHTML={{ __html: openAiLogo }} />
        </span>
        <span className="absolute top-[41px] left-[34px] flex size-[42px] items-center justify-center rounded-xl bg-claude text-white shadow-[0_4px_10px_rgb(217_119_87/30%)]">
          <span dangerouslySetInnerHTML={{ __html: claudeLogo }} />
        </span>
        <span className="absolute top-[35px] left-[85px] flex size-[54px] items-center justify-center rounded-[var(--shape-dialog)] bg-background shadow-[0_0_0_1px_rgb(0_0_0/6%),0_8px_20px_rgb(77_148_251/28%)]">
          <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
            <path
              d="M6.09 26.72 L15 3.28 L23.91 26.72"
              fill="none"
              stroke={promoMark}
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1="2.81"
              y1="20.63"
              x2="27.19"
              y2="14.06"
              stroke={promoSlash}
              strokeWidth="2.3"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="absolute top-[41px] left-[148px] flex size-[42px] items-center justify-center rounded-xl bg-ink shadow-[0_4px_10px_rgb(0_0_0/16%)]">
          <svg width="19" height="22" viewBox="1.35 0 19.3 22" aria-hidden="true">
            <path
              d="M1.73,5.21 L10.54,0.12 C10.82,-0.04 11.18,-0.04 11.46,0.12 L20.27,5.21 C20.51,5.35 20.65,5.6 20.65,5.87 L20.65,16.13 C20.65,16.4 20.51,16.65 20.27,16.79 L11.46,21.88 C11.18,22.04 10.82,22.04 10.54,21.88 L1.73,16.79 C1.49,16.65 1.35,16.41 1.35,16.13 L1.35,5.87 C1.35,5.6 1.49,5.35 1.73,5.21 Z M2.44,5.81 L19.44,5.81 C19.68,5.81 19.83,6.07 19.71,6.28 L11.21,21.01 C11.15,21.11 11,21.06 11,20.95 L11,11.31 C11,11.12 10.9,10.94 10.73,10.84 L2.38,6.02 C2.28,5.96 2.33,5.81 2.44,5.81 Z"
              fill={promoFill}
            />
          </svg>
        </span>
        <span className="absolute top-[45px] left-[200px] flex size-9 items-center justify-center rounded-[var(--shape-card)] bg-background text-muted-foreground shadow-[0_0_0_1px_var(--field-edge),0_4px_10px_rgb(0_0_0/6%)]">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <line x1="3.33" y1="8" x2="12.67" y2="8" stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" />
            <line x1="8" y1="3.33" x2="8" y2="12.67" stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" />
          </svg>
        </span>
        <span className="absolute top-2 left-[192px] flex size-6 items-center justify-center rounded-full bg-white/85 text-muted-foreground shadow-[0_0_0_1px_var(--line)]">
          <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
            <line
              x1="2.71"
              y1="6.5"
              x2="10.29"
              y2="6.5"
              stroke="currentColor"
              strokeWidth="1.19"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </div>
      <div className="px-4 pt-3">
        <h2 className="h-[19.5px] text-[length:var(--type-dense)] leading-[var(--leading-body)] font-semibold text-foreground">
          Bring your own agent
        </h2>
        <p className="mt-2 h-[34.81px] text-[length:var(--type-caption)] leading-[17.405px] text-muted-foreground">
          Claude or Codex can build decks here.
        </p>
        <a href={deckRoutes.connectAgent} className={cn(buttonVariants({ variant: "outline" }), "mt-5 w-full gap-1.5")}>
          <DeckGlyph name="plug" size={14} />
          Connect an agent
        </a>
      </div>
    </section>
  )
}
