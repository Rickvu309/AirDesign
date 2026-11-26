import gemini from "@/components/ui/gemini-art.svg"
import { claudeLogo } from "@/decks/agent-logos"
import { codexFill, codexTile } from "@/settings/settings-agent-art"

const codexMark =
  "M23.76,6.91 C24.63,8.4 24.82,10.19 24.28,11.82 C26.03,13.77 26.34,16.62 25.03,18.89 C24.18,20.39 22.72,21.44 21.03,21.79 C20.23,24.3 17.89,26 15.26,26 C13.54,26.01 11.89,25.28 10.75,23.99 C8.18,24.54 5.54,23.37 4.23,21.09 C3.36,19.6 3.18,17.81 3.72,16.18 C1.95,14.23 1.66,11.36 2.98,9.08 C3.83,7.58 5.29,6.53 6.98,6.18 C7.65,4.12 9.37,2.58 11.49,2.13 C13.61,1.68 15.8,2.4 17.25,4.01 C19.82,3.46 22.45,4.63 23.76,6.91 Z M15.26,24.43 C14.21,24.43 13.19,24.06 12.38,23.39 L12.52,23.31 L17.3,20.55 C17.54,20.41 17.69,20.15 17.69,19.87 L17.69,13.13 L19.71,14.3 C19.73,14.31 19.75,14.33 19.75,14.35 L19.75,19.93 C19.74,22.41 17.74,24.42 15.26,24.43 Z M5.6,20.3 C5.07,19.39 4.88,18.33 5.06,17.29 L5.2,17.38 L9.99,20.13 C10.23,20.27 10.53,20.27 10.77,20.13 L16.61,16.77 L16.61,19.1 C16.61,19.12 16.6,19.15 16.58,19.16 L11.74,21.95 C9.59,23.19 6.84,22.45 5.6,20.3 Z M4.34,9.9 C4.87,8.98 5.7,8.28 6.7,7.92 L6.7,13.6 C6.7,13.88 6.85,14.14 7.09,14.28 L12.91,17.63 L10.89,18.8 C10.87,18.81 10.83,18.81 10.81,18.8 L5.98,16.01 C3.83,14.77 3.1,12.02 4.34,9.87 L4.34,9.9 Z M20.93,13.75 L15.1,10.36 L17.12,9.2 C17.14,9.19 17.17,9.19 17.19,9.2 L22.02,11.99 C23.53,12.86 24.39,14.53 24.25,16.26 C24.11,17.99 22.97,19.49 21.34,20.1 L21.34,14.42 C21.33,14.14 21.17,13.88 20.93,13.75 Z M22.94,10.73 L22.8,10.64 L18.03,7.86 C17.79,7.72 17.48,7.72 17.24,7.86 L11.41,11.23 L11.41,8.9 C11.41,8.88 11.41,8.85 11.43,8.84 L16.26,6.05 C17.77,5.18 19.65,5.26 21.08,6.26 C22.51,7.26 23.24,8.99 22.94,10.71 L22.94,10.73 Z M10.3,14.86 L8.28,13.7 C8.26,13.69 8.25,13.66 8.25,13.64 L8.25,8.07 C8.25,6.33 9.26,4.75 10.84,4.01 C12.42,3.27 14.28,3.51 15.62,4.62 L15.48,4.7 L10.7,7.46 C10.46,7.6 10.31,7.86 10.31,8.14 L10.3,14.86 Z M11.4,12.5 L14,11 L16.61,12.5 L16.61,15.5 L14.01,17 L11.41,15.5 L11.4,12.5 Z"

export function AgentTile({ name }: { name: "claude" | "codex" | "gemini" }) {
  if (name === "gemini") {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background shadow-[inset_0_0_0_1px_var(--line)]">
        <img src={gemini} alt="" width={16} height={16} />
      </span>
    )
  }
  if (name === "codex") {
    return (
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: codexTile }}
      >
        <svg width="23.68" height="24" viewBox="2.16 2 23.68 24" aria-hidden="true">
          <path d={codexMark} fill={codexFill} fillRule="evenodd" />
        </svg>
      </span>
    )
  }
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-claude text-white">
      <span className="block size-6 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: claudeLogo }} />
    </span>
  )
}
