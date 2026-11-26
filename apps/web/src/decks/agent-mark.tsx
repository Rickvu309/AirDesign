import { AirdesignMark } from "@/components/ui/airdesign-mark"
import gemini from "@/components/ui/gemini-art.svg"
import type { ConnectMark } from "@/copy/connect-agent-copy"
import { claudeLogo, openAiLogo } from "@/decks/agent-logos"
import antigravity from "@/decks/antigravity-art.svg"
import { DeckGlyph } from "@/decks/deck-glyph"
import { cn } from "@/lib/class-names"

const drawn = { claude: claudeLogo, chatgpt: openAiLogo } as const
const pictured = { gemini, antigravity } as const
const plain = "bg-background text-quiet shadow-[inset_0_0_0_1px_var(--line)]"

export function AgentMark({
  name,
  size,
  className,
}: {
  name: ConnectMark | "airdesign"
  size: number
  className?: string
}) {
  const inner = Math.round(size * 0.58)
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[26%]",
        name === "claude" ? "bg-claude text-white" : name === "chatgpt" ? "bg-ink text-white" : plain,
        className,
      )}
      style={{ width: size, height: size }}
    >
      {name === "claude" || name === "chatgpt" ? (
        <span
          className="block [&_svg]:size-full"
          style={{ width: inner, height: inner }}
          dangerouslySetInnerHTML={{ __html: drawn[name] }}
        />
      ) : name === "airdesign" ? (
        <AirdesignMark size={inner} />
      ) : name === "other" ? (
        <DeckGlyph name="plug" size={inner} />
      ) : (
        <img src={pictured[name]} alt="" width={inner} height={inner} />
      )}
    </span>
  )
}
