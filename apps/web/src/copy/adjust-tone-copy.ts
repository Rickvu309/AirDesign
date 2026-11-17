import { airaCopy } from "./aira-copy.ts"

export const adjustToneCopy = {
  title: "Adjust tone",
  dial: "Tone dial",
  dialKeys: "Use arrow keys to move the dial. Press Enter to adjust the tone.",
  balanced: "Balanced",
  nothing: "No text to rewrite.",
  professional: "Professional",
  casual: "Casual",
  concise: "Concise",
  expanded: "Expanded",
  presets: ["Executive", "Technical", "Basic", "Educational"],
  retry: airaCopy.retry,
  reset: "Reset",
} as const
