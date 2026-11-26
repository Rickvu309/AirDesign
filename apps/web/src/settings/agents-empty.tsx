import { Button } from "@/components/ui/button"
import { connectAgentCopy } from "@/copy/connect-agent-copy"
import { settingsCopy } from "@/copy/settings-copy"
import { AgentMark } from "@/decks/agent-mark"
import { DeckGlyph } from "@/decks/deck-glyph"

const middle = 95
const rings = [
  { size: 96, edge: "shadow-[0_0_0_1px_rgb(77_148_251/30%)]" },
  { size: 190, edge: "shadow-[0_0_0_1px_rgb(77_148_251/20%)]" },
  { size: 300, edge: "shadow-[0_0_0_1px_rgb(77_148_251/14%)]" },
  { size: 430, edge: "shadow-[0_0_0_1px_rgb(77_148_251/9%)]" },
]
const lifted = "shadow-[0_0_0_1px_rgb(0_0_0/6%),0_4px_10px_rgb(0_0_0/8%)]"
const marks = [
  { name: "chatgpt", size: 36, from: -140, look: "shadow-[0_4px_10px_rgb(0_0_0/14%)]" },
  { name: "claude", size: 44, from: -76, look: "shadow-[0_4px_10px_rgb(217_119_87/30%)]" },
  { name: "airdesign", size: 60, from: 0, look: "shadow-[0_0_0_1px_rgb(0_0_0/6%),0_8px_20px_rgb(77_148_251/28%)]" },
  { name: "gemini", size: 44, from: 76, look: lifted },
  { name: "antigravity", size: 36, from: 140, look: lifted },
] as const

function placed(size: number, from = 0) {
  return { left: `calc(50% + ${from - size / 2}px)`, top: middle - size / 2 }
}

export function AgentsEmpty({ onConnect }: { onConnect: () => void }) {
  return (
    <section className="flex w-[860px] max-w-full flex-col items-center overflow-hidden rounded-xl bg-canvas pb-9">
      <div
        aria-hidden="true"
        className="relative h-[165px] self-stretch overflow-hidden [mask-image:linear-gradient(black_78%,transparent)]"
        style={{
          backgroundImage:
            "radial-gradient(34% 62% at 50% 50%, rgb(77 148 251 / 16%) 0%, rgb(77 148 251 / 5%) 55%, rgb(77 148 251 / 0%) 100%)",
        }}
      >
        {rings.map((ring) => (
          <span
            key={ring.size}
            className={`absolute rounded-full ${ring.edge}`}
            style={{ ...placed(ring.size), width: ring.size, height: ring.size }}
          />
        ))}
        {marks.map((mark) => (
          <span key={mark.name} className="absolute" style={placed(mark.size, mark.from)}>
            <AgentMark name={mark.name} size={mark.size} className={mark.look} />
          </span>
        ))}
      </div>
      <h2 className="text-[length:var(--type-section)] leading-5 font-semibold text-foreground">
        {settingsCopy.noAgents}
      </h2>
      <Button type="button" variant="signature" className="mt-4 gap-1.5 px-3.5" onClick={onConnect}>
        <DeckGlyph name="plug" size={14} />
        {connectAgentCopy.title}
      </Button>
    </section>
  )
}
